function init() {
	let input = document.querySelector('#search-box')
	for (let ev of ['change', 'keyup', 'paste', 'input']) {
		input.addEventListener(ev, filterTabs)
	}
	input.addEventListener('keydown', showTab)
	input.focus()
}

function showTab(e) {
	if (e.key !== 'Enter') {
		return
	}
	let tabs = document.querySelectorAll('li.hover-btn')
	for (let tab of tabs) {
		if (tab.style.display === 'block') {
			tab.click()
			return
		}
	}
}

function matchTab(toks, lnk) {
	let title = lnk.querySelector('.tab-lnk').innerText.toLowerCase()
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
	let tabs = document.querySelectorAll('li.hover-btn')
	for (let tab of tabs) {
		if (matchTab(toks, tab)) {
			tab.style.display = 'block'
		} else {
			tab.style.display = 'none'
		}
	}
}

init()
