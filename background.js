function handleMenu(info, tab) {
	switch (info.menuItemId) {
	case 'close-win':
		closeCurWin()
		break
	case 'close-tab':
		closeCurTab()
		break
	}
}

async function closeCurWin() {
	let win = await browser.windows.getCurrent()
	await browser.windows.remove(win.id)
}

async function closeCurTab() {
	let [tab] = await browser.tabs.query({active: true, currentWindow: true})
	await browser.tabs.remove(tab.id)
}

browser.browserAction.onClicked.addListener(() => {browser.sidebarAction.toggle()})

browser.menus.create({
  id: 'close-win',
  title: 'Close window',
  contexts: ['browser_action'],
})
browser.menus.create({
  id: 'close-tab',
  title: 'Close tab',
  contexts: ['browser_action'],
})
browser.menus.onClicked.addListener(handleMenu)
