for (const [name, ev] of Object.entries({
  'onActivated': browser.tabs.onActivated,
  'onAttached': browser.tabs.onAttached,
  'onCreated': browser.tabs.onCreated,
  'onDetached': browser.tabs.onDetached,
  'onMoved': browser.tabs.onMoved,
  'onRemoved': browser.tabs.onRemoved,
  'onReplaced': browser.tabs.onReplaced,
  'onUpdated': browser.tabs.onUpdated,
})) {
  ev.addListener(x => {
    console.log(name, x)
    if (name === 'onRemoved' || name === 'onDetached') {
      pinnedTabs.delete(x)
    } else if (name === 'onActivated') {
      setSuccessor()
    }
    refreshPage()
  })
}

async function setSuccessor() {
  let tabs = await browser.tabs.query({hidden: false, currentWindow: true})
  tabs.sort((a, b) => b.lastAccessed - a.lastAccessed)
  let tids = []
  for (let x of tabs) {
    tids.push(x.id)
  }
  browser.tabs.moveInSuccession(tids)
}

document.querySelector('#newtab-btn').onclick = newTab
document.querySelector('#replace-btn').onclick = replaceTab
document.querySelector('#dup-btn').onclick = dupTab
// document.querySelector('#inspect-btn').onclick = inspectTab
document.querySelector('#pin-btn').onclick = pinTab
document.querySelector('#detach-btn').onclick = detachTab
document.querySelector('#undo-btn').onclick = undoTab
document.querySelector('#close-cur-btn').onclick = closeCurTab
