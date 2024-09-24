var inMoving = {active: false, tids: new Set()}

function handleMenu(info, tab) {
	switch (info.menuItemId) {
	case 'close-win':
		closeCurWin()
		break
	case 'close-tab':
		closeCurTab()
		break
	case 'attach-tab':
		attachTab(tab)
		break
	}
}

async function closeCurWin() {
	if (await browser.sidebarAction.isOpen({})) {
		return
	}
	let win = await browser.windows.getCurrent()
	await browser.windows.remove(win.id)
}

async function closeCurTab() {
	if (await browser.sidebarAction.isOpen({})) {
		return
	}
	let tabs = await browser.tabs.query({currentWindow: true})
	if (tabs.length < 2) {
		return
	}
	for (let tab of tabs) {
		if (tab.active) {
			await browser.tabs.remove(tab.id)
			return
		}
	}
}

async function attachTab(tab) {
	let wins = await browser.windows.getAll({windowTypes: ['normal']})
	for (let w of wins) {
		if (w.id !== tab.windowId) {
			await browser.tabs.move(tab.id, {windowId: w.id, index: 0})
			await browser.tabs.update(tab.id, {active: true})
			await browser.windows.update(w.id, {focused: true})
			return
		}
	}
}

browser.browserAction.onClicked.addListener(() => {browser.sidebarAction.toggle()})

browser.menus.create({
  id: 'close-tab',
  title: 'Close to show tab',
  contexts: ['browser_action'],
})
browser.menus.create({
  id: 'close-win',
  title: 'Close window',
  contexts: ['browser_action'],
})
browser.menus.create({
  id: 'attach-tab',
  title: 'Attach tab',
  contexts: ['page'],
})
browser.menus.onClicked.addListener(handleMenu)
