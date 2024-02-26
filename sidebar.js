const isPopup = window.location.href.endsWith('popup')
const tabsDiv = document.querySelector('#tabs-div')
let stickyUl = document.querySelector('#sticky-ul')
let othersUl = document.querySelector('#others-ul')

async function buildTabList() {
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

	return [renderTabs(sticky, 'sticky-ul', false), renderTabs(others, 'others-ul', true)]
}

async function ensureStickyTabsIndex() {
	let sticky = await browser.tabs.query({currentWindow: true, autoDiscardable: false})
	let inOrder = true
	let tids = []
	for (let i = 0; i < sticky.length; i++) {
		if (i !== sticky[i].index) {
			inOrder = false
		}
		tids.push(sticky[i].id)
	}
	if (inOrder) {
		return
	}

	await browser.tabs.move(tids, {index: 0})
}

function stripHTMLTags(s) {
	let el = document.createElement('div')
	el.innerHTML = s
	return el.textContent
}

function renderTabs(tabs, cls, hasClose) {
	let ul = document.createElement('ul')
	ul.classList.add(cls)
	for (let t of tabs) {
		let li = document.createElement('li')
		li.id = `li-${t.id}`
		li.classList.add('hover-btn')
		if (t.active) {
			li.classList.add('active-tab')
		}

		let img = ''
		if (t.favIconUrl && !t.favIconUrl.startsWith('chrome://mozapps')) {
			img = `<img src='${t.favIconUrl}' class="favicon"> `
		}
		if (hasClose) {
			let title = stripHTMLTags(t.title)
			li.innerHTML = `
<span id='c-${t.id}' class='close-btn' title='close'>&nbsp;⨯&nbsp;</span><span class='tab-lnk' id='t-${t.id}' title='${title} - ${t.url}'>${img}${title}</span>
`
			li.querySelector('.close-btn').onclick = closeThisTab
		} else {
            li.innerHTML = `
&nbsp;&nbsp;<span class='tab-lnk' id='t-${t.id}' title='${t.title} - ${t.url}'>${img}${t.title}</span>
`
		}
		li.onclick = focusThisTab
		li.onauxclick = closeThisTab
		ul.appendChild(li)
	}
	return ul
}

async function refreshPage() {
	let [sticky, others] = await buildTabList()
	tabsDiv.replaceChild(sticky, stickyUl)
	stickyUl = sticky
	if (stickyUl.childElementCount === 0) {
		stickyUl.classList.add('hidden')
	}

	tabsDiv.replaceChild(others, othersUl)
	othersUl = others
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
	let tabs = await browser.tabs.query({currentWindow: true})
	let numSticky = 0
	let cur = null
	for (let t of tabs) {
		if (t.active) {
			cur = t
		}
		if (!t.autoDiscardable) {
			numSticky++
		}
	}
	if (!cur) {
		console.log('cannot find active tab', tabs)
		return
	}

	if (!cur.autoDiscardable) {
		// sticky -> non-sticky
		await browser.tabs.update(cur.id, {autoDiscardable: true})
		// place behind sticky tabs
		await browser.tabs.move(cur.id, {index: numSticky-1})
	} else {
		// non-sticky -> sticky
		await browser.tabs.update(cur.id, {autoDiscardable: false})
		await browser.tabs.move(cur.id, {index: 0})
		await ensureStickyTabsIndex()
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
	let [tab] = await browser.tabs.query({active: true, currentWindow: true})
	let newTab = await browser.tabs.duplicate(tab.id, {active: false})
	if (tab.autoDiscardable) {
		// put duplicate next to the tab
		await browser.tabs.move(newTab.id, {index: tab.index})
	}
}

async function groupTabs(ev) {
	let tabs = await browser.tabs.query({currentWindow: true, autoDiscardable: true})
	tabs.sort((a, b) => {
		let hosta = new URL(a.url).hostname.replace(/^www\./, '')
		let hostb = new URL(b.url).hostname.replace(/^www\./, '')
		if (hosta < hostb) {
			return -1
		} else if (hosta > hostb) {
			return 1
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

async function archivePhPage(ev) {
	const archive = "https://archive.ph/"
	let [tab] = await browser.tabs.query({active: true, currentWindow: true})
	let url = tab.url
	if (url.startsWith(archive)) {
		return
	}
	// e.g. https://archive.ph/submit/?submitid=Fo6mIYROjR8%2F6xOxYj1Dl6taQzWMDjsWTIgoDt09KaVTrxOx9flzbQfdDiUt5Qr2&url=https%3A%2F%2Fwww.wsj.com%2Ftech%2Fai%2Fsam-altman-openai-protected-by-silicon-valley-friends-f3efcf68
	let resp = await fetch(archive)
	let text = await resp.text()
	let dom = new DOMParser()
	let doc = dom.parseFromString(text, 'text/html')
	let submitid = doc.body.querySelector('input[name=submitid]').value
	let arurl = `${archive}submit/?submitid=${submitid}&url=${url}`
	await browser.tabs.update({url: arurl})
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
	await browser.tabs.update({url: url})
}

async function onCreated(t) {
	let sticky = await browser.tabs.query({currentWindow: true, autoDiscardable: false})
	await browser.tabs.move(t.id, {index: sticky.length})
	await ensureStickyTabsIndex()
}

async function unpinAll() {
	let pinned = await browser.tabs.query({pinned: true})
	for (let t of pinned) {
		await browser.tabs.update(t.id, {'pinned': false})
	}
}

async function onRemoved(removed) {
	let tabs = await browser.tabs.query({currentWindow: true})
	for (let t of tabs) {
		if (t.id === removed) {
			// for whatever reason, the current tab that is removed by "Close Tab"
			// or the keyboard shortcut can be still in tabs.
			// retry after 30ms
			setTimeout(() => onRemoved(removed), 30)
		}
	}
	refreshPage()
}

browser.tabs.onCreated.addListener(onCreated)
browser.tabs.onRemoved.addListener(onRemoved)
browser.tabs.onActivated.addListener(refreshPage)
browser.tabs.onAttached.addListener(refreshPage)
browser.tabs.onReplaced.addListener(refreshPage)
browser.tabs.onUpdated.addListener(refreshPage)
browser.tabs.onDetached.addListener(refreshPage)
browser.tabs.onMoved.addListener(refreshPage)

unpinAll()
refreshPage()
