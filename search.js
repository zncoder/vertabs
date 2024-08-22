async function init() {
	await renderTabs()

	let input = document.querySelector('#search-box')
	for (let ev of ['change', 'keyup', 'paste', 'input']) {
		input.addEventListener(ev, filterTabs)
	}
	input.addEventListener('keydown', showTab)
	input.focus()
}

const tabTmpls = `
{{begin_li}}
    <li id="t-{{id}}-{{wid}}" class="tab-li">{{title}}</li>
{{end_li}}
`

async function renderTabs() {
	let liObjs = []
	let tabs = await getAllTabs()
	for (const t of tabs) {
		let obj = {}
		obj.id = t.id
		obj.wid = t.windowId
		obj.title = stripHTMLTags(t.title)
		liObjs.push(obj)
	}

	let s = renderTemplate(tabTmpls, {li: liObjs})
	let ul = document.querySelector('#tabs-ul')
	ul.innerHTML = s

	let lis = document.querySelectorAll('.tab-li')
	for (let li of lis) {
		let [_, tid, wid] = li.id.split('-')
		li.addEventListener('click', () => gotoTab(parseInt(tid), parseInt(wid)))
	}
}

async function getAllTabs() {
	let tabs = await browser.tabs.query({})
	let cw = await browser.windows.getCurrent()
	let curs = []
	let others = []
	for (const t of tabs) {
		let u = new URL(t.url)
		if (u.protocol === 'moz-extension:' && u.pathname === '/search.html' && u.hash === '#search') {
			continue
		}
		if (t.windowId === cw.id) {
			curs.push(t)
		} else {
			others.push(t)
		}
	}
	return curs.concat(others)
}

function showTab(e) {
	if (e.key !== 'Enter') {
		return
	}
	let lis = document.querySelectorAll('.tab-li')
	for (let li of lis) {
		if (li.style.display === 'block') {
			let [_, tid, wid] = li.id.split('-')
			gotoTab(parseInt(tid), parseInt(wid))
			return
		}
	}
}

async function gotoTab(tid, wid) {
	await browser.tabs.update(tid, {active: true})
	await browser.windows.update(wid, {focused: true})
	window.close()
}

function matchTab(toks, li) {
	let title = li.innerText.toLowerCase()
	for (let tok of toks) {
		if (!title.includes(tok)) {
			return false
		}
	}
	return true
}

function filterTabs() {
	let search = document.querySelector('#search-box').value
	let toks = search.split(/\s+/)
	let lis = document.querySelectorAll('.tab-li')
	for (let li of lis) {
		if (matchTab(toks, li)) {
			li.style.display = 'block'
		} else {
			li.style.display = 'none'
		}
	}
}

init()
