const isPopup = window.location.href.endsWith('popup') || window.location.href.endsWith('search')
const tabsDiv = document.querySelector('#tabs-div')
let stickyUl = document.querySelector('#sticky-ul')
let othersUl = document.querySelector('#others-ul')
let bg

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

const uiTmpls = {
	'sticky-ul': `
<ul class="{{cls}}">
    {{begin_li}}
    <li id="li-{{id}}" draggable="true" class="hover-btn {{active_tab}} {{prev_tab}}">
        <span id="t-{{id}}" class="tab-lnk" title="{{title}} - {{url}}">{{img}}{{title}}</span>
    </li>{{end_li}}
</ul>
`,
	'others-ul': `
<ul class="{{cls}}">
	{{begin_li}}
    <li id="li-{{id}}" draggable="true" class="hover-btn {{active_tab}} {{move_tab}} {{prev_tab}} {{csid_cls}}">
		<span id="c-{{id}}" class="close-btn" title="close">&nbsp;⨯&nbsp;</span><span id="t-{{id}}" class="tab-lnk" title="{{title}} - {{url}}">{{img}}{{title}}</span>
  	</li>{{end_li}}
</ul>
 `
}

function groupTabsByCookieStoreId(tabs) {
	let tabsByCsid = {}
	let ok
	for (const t of tabs) {
		if (t.cookieStoreId === 'firefox-default') {
			continue
		}
		ok = true
		if (!tabsByCsid[t.cookieStoreId]) {
			tabsByCsid[t.cookieStoreId] = []
		}
		tabsByCsid[t.cookieStoreId].push(t)
	}
	return ok ? tabsByCsid : undefined
}

function getGroupClassByCsid(tabsByCsid, t, sfx) {
	let cstabs = tabsByCsid[t.cookieStoreId]
	if (cstabs && cstabs.length > 1) {
		if (t.id === cstabs[0].id) {
			return `cs-begin-${sfx}`
		} else if (t.id === cstabs[cstabs.length-1].id) {
			return `cs-end-${sfx}`
		} else {
			return `cs-middle-${sfx}`
		}
	}
	return undefined
}

function rootOpenerId(t, tabsById) {
	while (true) {
		let opener = tabsById[t.openerTabId]
		if (opener) {
			t = opener
		} else {
			return t.id
		}
	}
}

function groupTabsByOpener(tabs, tabsById) {
	// opener of tab without openerTabId is the tab itself
	let tabsByOpener = {} // openerTabId -> [tabs]
	for (const t of tabs) {
		let opener = rootOpenerId(t, tabsById)
		if (!tabsByOpener[opener]) {
			tabsByOpener[opener] = []
		}
		tabsByOpener[opener].push(t)
	}
	return tabsByOpener
}

function getGroupClassByOpener(tabsByOpener, tabsById, t, sfx) {
	let opener = rootOpenerId(t, tabsById)
	let tabs = tabsByOpener[opener]
	if (tabs && tabs.length > 1) {
		if (t.id === tabs[0].id) {
			return `cs-begin-${sfx}`
		} else if (t.id === tabs[tabs.length-1].id) {
			return `cs-end-${sfx}`
		} else {
			return `cs-middle-${sfx}`
		}
	}
	return undefined
}

function getLiTid(el) {
	while (el) {
		if (el.tagName === 'LI') {
			if (el.id.startsWith('li-')) {
				return parseInt(el.id.slice(3))
			}
			return undefined
		}
		el = el.parentElement
	}
	return undefined
}

function onDragStart(ev) {
	let tid = getLiTid(ev.target)
	if (tid) {
		ev.dataTransfer.setData('text/plain', `${tid}/${ev.clientY}`)
	}
}

function onDragOver(ev) {
	ev.preventDefault()
}

async function onDragDrop(ev) {
	ev.preventDefault()
	let [a, b] = ev.dataTransfer.getData('text/plain').split('/')
	let initY = parseInt(b)
	let up = initY > ev.clientY
	let sid = parseInt(a)
	let did = getLiTid(ev.target)
	if (!sid || !did) {
		console.log('invalid drop', sid, did, ev)
		return
	}
	let st = await browser.tabs.get(sid)
	let dt = await browser.tabs.get(did)
	if (!st || !dt) {
		console.log('invalid tabs', st, dt)
		return
	}
	if (st.autoDiscardable !== dt.autoDiscardable) {
		console.log('cannot move between sticky and non-sticky', st, dt)
		return
	}
	// use openTabId to group them
	await browser.tabs.update(st.id, {openerTabId: dt.id})
	if (up) {
		await browser.tabs.move(st.id, {index: dt.index})
	} else {
		await browser.tabs.move(st.id, {index: dt.index})
	}
}

function renderTabs(tabs, cls, prev) {
	const tmpl = uiTmpls[cls]
	if (!tmpl) {
		console.error('no template for', cls)
		return
	}
	let tabsById = {}
	for (const t of tabs) {
		tabsById[t.id] = t
	}
	let tabsByCsid = groupTabsByCookieStoreId(tabs)
	let tabsByOpener = tabsByCsid ? undefined : groupTabsByOpener(tabs, tabsById)

	let liObjs = []
	let sfx = 0
	for (const t of tabs) {
		let obj = {}
		obj.id = t.id
		if (t.active) {
			obj.active_tab = 'active-tab'
		} else if (prev && prev.id === t.id) {
			obj.prev_tab = 'prev-tab'
			// console.log('prev', prev.id, prev.title)
		}
		if (bg.inMoving.tids.has(t.id)) {
			obj.move_tab = 'move-tab'
		}
		if (t.favIconUrl && !t.favIconUrl.startsWith('chrome://mozapps')) {
			obj.img = `<img src='${t.favIconUrl}' class="favicon"> `
		}
		let cscls = tabsByCsid ? getGroupClassByCsid(tabsByCsid, t, sfx) : getGroupClassByOpener(tabsByOpener, tabsById, t, sfx)
		if (cscls) {
			obj.csid_cls = cscls
			if (cscls.startsWith('cs-end')) {
				sfx = (sfx + 1) % 2
			}
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
		li.onclick = focusThisOrPrevTab
		li.onauxclick = closeThisTab
		li.ondragstart = onDragStart
		li.ondragover = onDragOver
		li.ondrop = onDragDrop
	})
	ul.querySelectorAll('.close-btn').forEach(btn => {
		btn.onclick = closeThisTab
	})
	return ul
}

async function refreshPage() {
	let [sticky, others] = await listTab()
	// console.log('refreshpage sticky', sticky, 'others', others)

	let prev = findPrevTab(sticky.concat(others))

	let newStickyUI = renderTabs(sticky, 'sticky-ul', prev)
	let newOthersUI = renderTabs(others, 'others-ul', prev)

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

async function focusPrevTab() {
	let tabs = await browser.tabs.query({currentWindow: true})
	let prev = findPrevTab(tabs)
	if (prev) {
		await browser.tabs.update(prev.id, {active: true})
	}
}

function findPrevTab(tabs) {
	let prev = null
	for (let t of tabs) {
		if (!t.active && (!prev || prev.lastAccessed < t.lastAccessed)) {
			prev = t
		}
	}
	return prev
}

async function focusThisOrPrevTab(ev) {
	ev.preventDefault()
	let tid = getTabId(ev)
	let [cur] = await browser.tabs.query({active: true, currentWindow: true})
	if (tid === cur.id) {
		await focusPrevTab()
	} else {
		await browser.tabs.update(tid, {active: true})
	}
	[cur] = await browser.tabs.query({active: true, currentWindow: true})
	await addTabToInMoving(cur)
	if (isPopup) {
		window.close()
	} else {
		await refreshPage()
	}
}

function newTab(ev) {
	browser.tabs.create({active: true})
}

async function newTabWithUrl(ev) {
	let text = await navigator.clipboard.readText()
	text = text.trim()
	if (text.length === 0) {
		return
	}
	let url = text
	if (url.startsWith('/')) {
		url = 'file://' + url
	} else if (!url.startsWith('https://') && !url.startsWith('http://')) {
		url = 'https://' + url
	}
	if (text !== url) {
		console.log('new tab with url', text, '=>', url)
	}
	await browser.tabs.create({active: true, url: url})
}

async function stickTab(ev) {
	let [sticky, others] = await listTab()
	let [cur] = await browser.tabs.query({active: true, currentWindow: true})
	if (cur.autoDiscardable) {
		// non-sticky -> sticky
		await browser.tabs.update(cur.id, {autoDiscardable: false})
		await browser.tabs.move(cur.id, {index: sticky.length})
	} else {
		// stickey -> non-sticky
		await browser.tabs.update(cur.id, {autoDiscardable: true})
		await browser.tabs.move(cur.id, {index: sticky.length-1})
	}
}

async function upTab(ev) {
	moveUpTab(false)
}

async function moveUpTab(top) {
	let [sticky, others] = await listTab()
	await fixTabIndex(sticky, 0)
	await fixTabIndex(others, sticky.length)
	let [t] = await browser.tabs.query({active: true, currentWindow: true})
	let index = t.index
	if (t.autoDiscardable) {
		if (top) {
			index = sticky.length
		} else if (t.index > sticky.length) {
			index = t.index-1
		}
	} else {
		if (top) {
			index = 0
		} else if (t.index > 0) {
			index = t.index-1
		}
	}
	// console.log('up', t.index, index)
	if (index < t.index) {
		await browser.tabs.move(t.id, {index: index})
	}
}

async function topTab(ev) {
	moveUpTab(true)
}

async function downTab(ev) {
	moveDownTab(false)
}

async function bottomTab(ev) {
	moveDownTab(true)
}

async function moveDownTab(bottom) {
	let [sticky, others] = await listTab()
	await fixTabIndex(sticky, 0)
	await fixTabIndex(others, sticky.length)
	let [t] = await browser.tabs.query({active: true, currentWindow: true})
	let index = t.index
	if (t.autoDiscardable) {
		if (bottom) {
			index = -1
		} else if (t.index < sticky.length+others.length-1) {
			index = t.index+1
		} else {
			index = sticky.length
		}
	} else {
		if (bottom) {
			index = sticky.length-1
		} else if (t.index < sticky.length-1) {
			index = t.index+1
		} else {
			index = 0
		}
	}
	// console.log('down', t.index, index)
	if (index != t.index) {
		await browser.tabs.move(t.id, {index: index})
	}
}

async function searchTab(ev) {
	await browser.tabs.create({active: true, url: '/search.html#search'})
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

async function moveTabs(ev, detach) {
	if (!bg.inMoving.active) {
		bg.inMoving.active = true
		await browser.browserAction.setBadgeText({text: '!'})
		let [tab] = await browser.tabs.query({active: true, currentWindow: true})
		await addTabToInMoving(tab)
		await refreshPage()
		return
	}

	await browser.browserAction.setBadgeText({text: ''})
	bg.inMoving.active = false
	if (bg.inMoving.tids.size === 0) {
		return
	}

	let tids = []
	for (let tid of bg.inMoving.tids) {
		try {
			let t = await browser.tabs.get(tid)
			if (t.autoDiscardable) {
				tids.push(tid)
			}
		} catch (e) {
			// ignore
		}
	}
	bg.inMoving.tids.clear()

	let win
	let idx = detach ? 1 : 0
	if (detach) {
		win = await browser.windows.create({tabId: tids[0]})
		tids.splice(0, 1)
	} else {
		win = await browser.windows.getCurrent()
	}
	await browser.tabs.move(tids, {windowId: win.id, index: idx})
}

async function addTabToInMoving(tab) {
	if (!bg.inMoving.active) {
		return
	}
	if (tab.autoDiscardable ) {
		bg.inMoving.tids.add(tab.id)
	}
}

function detachTabs(ev) {
	moveTabs(ev, true)
}

async function popupTab(ev) {
	let [tab] = await browser.tabs.query({active: true, currentWindow: true})
	browser.windows.create({tabId: tab.id, type: 'popup'})
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
			return csa < csb ? -1 : 1
		}

		let hosta = new URL(a.url).hostname.replace(/^www\./, '')
		let hostb = new URL(b.url).hostname.replace(/^www\./, '')
		if (hosta !== hostb) {
			return hosta < hostb ? -1 : 1
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
	if (t.cookieStoreId === 'firefox-default') {
		if (t.openerTabId) {
			for (let i = 0; i < tabs.length; i++) {
				if (tabs[i].id === t.openerTabId) {
					tabs.splice(i, 0, t)
					return
				}
			}
		}
		tabs.splice(0, 0, t)
		return
	}
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
	bg = await browser.runtime.getBackgroundPage()
	await unpinAll()
	await refreshPage()
	enableListener()
}

init()
