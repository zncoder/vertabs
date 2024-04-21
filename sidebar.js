const isPopup = window.location.href.endsWith('popup')
const tabsDiv = document.querySelector('#tabs-div')
let stickyUl = document.querySelector('#sticky-ul')
let othersUl = document.querySelector('#others-ul')

async function listTab() {
	let sticky = []
	let others = []
	let tabs = await browser.tabs.query({currentWindow: true})
	for (let t of tabs) {
		if (!t.autoDiscardable) {
			sticky.push(t)
		} else {
			others.push(t)
		}
	}
	return [sticky, others]
}

async function fixTabIndex(tabs, base) {
	let inOrder = true
	let tids = []
	for (let i = 0; i < tabs.length; i++) {
		if (i !== tabs[i].index) {
			inOrder = false
		}
		tids.push(tabs[i].id)
	}
	if (!inOrder) {
		await browser.tabs.move(tids, {index: base})
	}
}

function stripHTMLTags(s) {
	let el = document.createElement('div')
	el.innerHTML = s
	return el.textContent
}

const uiTmpls = {
	'sticky-ul': `
<ul class="{{cls}}">
    {{begin_li}}
    <li id="li-{{id}}" class="hover-btn {{active_tab}}">
        &nbsp;&nbsp;<span id="t-{{id}}" class="tab-lnk" title="{{title}} - {{url}}">{{img}}{{title}}</span>
    </li>{{end_li}}
</ul>
`,
	'others-ul': `
<ul class="{{cls}}">
	{{begin_li}}
    <li id="li-{{id}}" class="hover-btn {{active_tab}} {{csid_cls}}">
		<span id="c-{{id}}" class="close-btn" title="close">&nbsp;⨯&nbsp;</span><span id="t-{{id}}" class="tab-lnk" title="{{title}} - {{url}}">{{img}}{{title}}</span>
  	</li>{{end_li}}
</ul>
 `
}

function groupTabsByCookieStoreId(tabs) {
	let tabsByCsid = {}
	for (const t of tabs) {
		if (t.cookieStoreId === 'firefox-default') {
			continue
		}
		if (!tabsByCsid[t.cookieStoreId]) {
			tabsByCsid[t.cookieStoreId] = []
		}
		tabsByCsid[t.cookieStoreId].push(t)
	}
	return tabsByCsid
}

function getGroupClass(tabsByCsid, t) {
	let cstabs = tabsByCsid[t.cookieStoreId]
	if (cstabs && cstabs.length > 1) {
		if (t.id === cstabs[0].id) {
			return 'cs-begin'
		} else if (t.id === cstabs[cstabs.length-1].id) {
			return 'cs-end'
		} else {
			return 'cs-middle'
		}
	}
	return undefined
}

function renderTabs(tabs, cls) {
	const tmpl = uiTmpls[cls]
	if (!tmpl) {
		console.error('no template for', cls)
		return
	}
	let tabsByCsid = groupTabsByCookieStoreId(tabs)

	let liObjs = []
	for (const t of tabs) {
		let obj = {}
		obj.id = t.id
		if (t.active) {
			obj.active_tab = 'active-tab'
		}
		if (t.favIconUrl && !t.favIconUrl.startsWith('chrome://mozapps')) {
			obj.img = `<img src='${t.favIconUrl}' class="favicon"> `
		}
		let cscls = getGroupClass(tabsByCsid, t)
		if (cscls) {
			obj.csid_cls = cscls
		}
		obj.title = stripHTMLTags(t.title)
		obj.url = t.url
		liObjs.push(obj)
	}
	let s = renderTemplate(uiTmpls[cls], {cls: cls, li: liObjs})
	let div = document.createElement('div')
	div.innerHTML = s
	let ul = div.querySelector('ul')
	ul.querySelectorAll('li').forEach(li => {
		li.onclick = focusThisTab
		li.onauxclick = closeThisTab
	})
	ul.querySelectorAll('.close-btn').forEach(btn => {
		btn.onclick = closeThisTab
	})
	return ul
}

async function refreshPage() {
	let [sticky, others] = await listTab()
	console.log('refreshpage sticky', sticky, 'others', others)

	let newStickyUI = renderTabs(sticky, 'sticky-ul')
	let newOthersUI = renderTabs(others, 'others-ul')

	tabsDiv.replaceChild(newStickyUI, stickyUl)
	stickyUl = newStickyUI
	if (stickyUl.childElementCount === 0) {
		stickyUl.classList.add('hidden')
	}

	tabsDiv.replaceChild(newOthersUI, othersUl)
	othersUl = newOthersUI
}

function getTabId(ev) {
	return parseInt(ev.target.id.split('-')[1])
}

function closeThisTab(ev) {
	ev.preventDefault()
	ev.stopPropagation()
	closeTab(getTabId(ev))
}

function closeTab(tid) {
	let li = document.querySelector(`#li-${tid}`)
	li.parentNode.removeChild(li)
	browser.tabs.remove([tid])
}

async function prevTab(ev) {
	ev.preventDefault()
	let tabs = await browser.tabs.query({currentWindow: true})
	let prev = null
	for (let t of tabs) {
		if (!t.active && (!prev || prev.lastAccessed < t.lastAccessed)) {
			prev = t
		}
	}
	if (prev) {
		browser.tabs.update(prev.id, {active: true})
	}
}

function focusThisTab(ev) {
	ev.preventDefault()
	let tid = getTabId(ev)
	browser.tabs.update(tid, {active: true})
	if (isPopup) {
		window.close()
	}
}

function newTab(ev) {
	browser.tabs.create({active: true})
}

async function newTabWithUrl(ev) {
	let url = await navigator.clipboard.readText()
	console.log('url', url)
	if (url.startsWith("https://") || url.startsWith("http://")) {
		await browser.tabs.create({active: true, url: url})
	}
}

async function stickTab(ev) {
	let [sticky, others] = await listTab()
	let [cur] = await browser.tabs.query({active: true, currentWindow: true})
	if (cur.autoDiscardable) {
		// non-sticky -> sticky
		await browser.tabs.update(cur.id, {autoDiscardable: false})
		await browser.tabs.move(cur.id, {index: 0})
	} else {
		// stickey -> non-sticky
		await browser.tabs.update(cur.id, {autoDiscardable: true})
		await browser.tabs.move(cur.id, {index: sticky.length-1})
	}
}

async function bottomTab(ev) {
	let [t] = await browser.tabs.query({active: true, currentWindow: true})
	await browser.tabs.move(t.id, {index: -1})
}

async function undoTab(ev) {
	let [sess] = await browser.sessions.getRecentlyClosed({maxResults: 1})
	if (sess && sess.tab) {
		browser.sessions.restore(sess.tab.sessionId)
	}
}

async function hideSidebar(ev) {
	browser.sidebarAction.toggle()
}

async function closeCurTab(ev) {
	let [tab] = await browser.tabs.query({active: true, currentWindow: true})
	if (tab) {
		closeTab(tab.id)
	}
}

async function detachTab(ev) {
	let [tab] = await browser.tabs.query({active: true, currentWindow: true})
	if (tab) {
		browser.windows.create({tabId: tab.id})
	}
}

async function replaceTab(ev) {
	await closeCurTab(ev)
	await newTab(ev)
}

async function dupTab(ev) {
	let [sticky, others] = await listTab()
	let [tab] = await browser.tabs.query({active: true, currentWindow: true})
	let index = tab.autoDiscardable ? tab.index : sticky.length
	await browser.tabs.duplicate(tab.id, {active: false, index: index})
}

async function groupTabs(ev) {
	let tabs = await browser.tabs.query({currentWindow: true, autoDiscardable: true})
	tabs.sort((a, b) => {
		// group by container and then host
		let csa = a.cookieStoreId
		let csb = b.cookieStoreId
		if (csa !== csb) {
			return csa < csb ? -1 : 1;
		}

		let hosta = new URL(a.url).hostname.replace(/^www\./, '')
		let hostb = new URL(b.url).hostname.replace(/^www\./, '')
		if (hosta !== hostb) {
			return hosta < hostb ? -1 : 1;
		}
		return a.index - b.index
	})
	let tids = tabs.map(t => t.id)
	await browser.tabs.move(tids, {index: -1})
}

async function zoomPage(ev) {
	let level = await browser.tabs.getZoom()
	level += 0.2
	if (level > 2) {
		level = 0
	}
	await browser.tabs.setZoom(level)
}

async function archivePage(ev) {
	const archiveSite = "https://archive.is/"

	let [tab] = await browser.tabs.query({active: true, currentWindow: true})
	let url = tab.url
	if (url.startsWith(archiveSite)) {
		for (let i = 0; i < 3; i++) {
			await browser.tabs.goBack()
			let [t] = await browser.tabs.query({active: true, currentWindow: true})
			if (!t.url.startsWith(archiveSite)) {
				break
			}
		}
		return
	}

	// e.g. https://archive.is/submit/?submitid=Fo6mIYROjR8%2F6xOxYj1Dl6taQzWMDjsWTIgoDt09KaVTrxOx9flzbQfdDiUt5Qr2&url=https%3A%2F%2Fwww.wsj.com%2Ftech%2Fai%2Fsam-altman-openai-protected-by-silicon-valley-friends-f3efcf68
	let resp = await fetch(archiveSite)
	let text = await resp.text()
	let dom = new DOMParser()
	let doc = dom.parseFromString(text, 'text/html')
	let submitid = doc.body.querySelector('input[name=submitid]').value
	let arurl = `${archiveSite}submit/?submitid=${submitid}&url=${url}`
	await browser.tabs.update({url: arurl})
	ev.target.blur()
}

async function archiveOrgPage(ev) {
	const archive = 'https://web.archive.org'
	let [tab] = await browser.tabs.query({active: true, currentWindow: true})
	let url = tab.url
	if (url.startsWith(archive)) {
		let i = url.lastIndexOf('https://')
		url = url.substring(i)
	} else {
		url = `https://web.archive.org/${url}`
	}
	await browser.tabs.update({url: url, loadReplace: true})
}

function removeTab(tabs, t) {
	for (let i = 0; i < tabs.length; i++) {
		if (tabs[i].id === t.id) {
			tabs.splice(i, 1)
			return true
		}
	}
	return false
}

async function addTab(tabs, t) {
	for (let i = 0; i < tabs.length; i++) {
		if (tabs[i].cookieStoreId === t.cookieStoreId) {
			tabs.splice(i, 0, t)
			return
		}
	}
	tabs.splice(0, 0, t)
}

async function onCreated(t) {
	console.log('created', t.id, t.index, t.openerTabId)
	let [sticky, others] = await listTab()
	if (removeTab(others, t)) {
		addTab(others, t)
		await fixTabIndex(others, sticky.length)
	}
}

async function unpinAll() {
	let pinned = await browser.tabs.query({pinned: true})
	for (let t of pinned) {
		await browser.tabs.update(t.id, {'pinned': false})
	}
}

async function onRemoved(removed) {
	console.log('removed', removed)
	let tabs = await browser.tabs.query({currentWindow: true})
	for (let t of tabs) {
		if (t.id === removed) {
			// for whatever reason, the current tab that is removed by "Close Tab"
			// or the keyboard shortcut can be still in tabs.
			// retry after 30ms
			setTimeout(() => onRemoved(removed), 30)
		}
	}
	await refreshPage()
}

async function onActivated() {
	console.log('activated')
	await refreshPage()
}

async function onAttached() {
	console.log('attached')
	let [sticky, others] = await listTab()
	await fixTabIndex(sticky, 0)
	await refreshPage()
}

async function onReplaced() {
	console.log('replaced')
	await refreshPage()
}

async function onUpdated() {
	console.log('updated')
	await refreshPage()
}

async function onDetached() {
	console.log('detached')
	await refreshPage()
}

async function onMoved() {
	console.log('moved')
	await refreshPage()
}

function enableListener() {
	browser.tabs.onCreated.addListener(onCreated)
	browser.tabs.onRemoved.addListener(onRemoved)
	browser.tabs.onActivated.addListener(onActivated)
	browser.tabs.onAttached.addListener(onAttached)
	browser.tabs.onReplaced.addListener(onReplaced)
	browser.tabs.onUpdated.addListener(onUpdated)
	browser.tabs.onDetached.addListener(onDetached)
	browser.tabs.onMoved.addListener(onMoved)
}

async function init() {
	await unpinAll()
	await refreshPage()
	enableListener()
}

init()
