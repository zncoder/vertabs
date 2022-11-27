const tabsDiv = document.querySelector('#tabs-div')
let tabsUl = document.querySelector('#tabs-ul')
let pinnedTabs = new Set()

function isPinned(t) {
  return t.pinned || pinnedTabs.has(t.id)
}

function cmpTabs(choice, ta, tb) {
  if (isPinned(ta) !== isPinned(tb)) {
    return isPinned(ta) ? -1 : 1
  } else if (isPinned(ta)) {
    return ta.id - tb.id
  } else if (choice === 'last-access') {
    x = tb.lastAccessed - ta.lastAccessed
    return x
  } else if (choice == 'hostname') {
    let ua = new URL(ta.url)
    let ub = new URL(tb.url)
    if (ua.hostname != ub.hostname) {
      return ua.hostname.localeCompare(ub.hostname)
    }
  }
  return ta.id - tb.id
}

async function buildTabList() {
  let tabs = await browser.tabs.query({currentWindow: true})
  let options = await browser.storage.local.get('sortChoice')
  let choice = options.sortChoice ? options.sortChoice : 'last-access'
  tabs.sort((ta, tb) => cmpTabs(choice, ta, tb))

  let ul = document.createElement('ul')
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
    li.innerHTML = `
<span id='c-${t.id}' class='close-btn' title='close'>&nbsp;⨯&nbsp;</span><span class='tab-lnk' id='t-${t.id}' title='${t.title} - ${t.url}'>${img}${t.title}</span>
`
    li.querySelector('.close-btn').onclick = closeThisTab
    li.querySelector('.tab-lnk').onclick = focusThisTab
    ul.appendChild(li)
  }
  return ul
}

async function refreshPage() {
  let newUl = await buildTabList()
  tabsDiv.replaceChild(newUl, tabsUl)
  tabsUl = newUl
}

function getTabId(ev) {
  return parseInt(ev.target.id.substring(2))
}

function closeThisTab(ev) {
  // console.log('closethistab', ev.target)
  let tid = getTabId(ev)
  closeTab(tid)
}

function closeTab(tid) {
  let li = document.querySelector(`#li-${tid}`)
  tabsUl.removeChild(li)
  browser.tabs.remove([tid])
}

function focusThisTab(ev) {
  let tid = getTabId(ev)
  browser.tabs.update(tid, {active: true})
}

function newTab(ev) {
  browser.tabs.create({active: true})
}

async function pinTab(ev) {
  let [tab] = await browser.tabs.query({active: true, currentWindow: true})
  if (isPinned(tab)) {
    pinnedTabs.delete(tab.id)
    browser.tabs.update(tab.id, {pinned: false})
  } else {
    pinnedTabs.add(tab.id)
  }
}

async function undoTab(ev) {
  let [sess] = await browser.sessions.getRecentlyClosed({maxResults: 1})
  if (sess && sess.tab) {
    browser.sessions.restore(sess.tab.sessionId)
  }
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
    }
    refreshPage()
  })
}

document.querySelector('#newtab-btn').onclick = newTab
document.querySelector('#pin-btn').onclick = pinTab
document.querySelector('#detach-btn').onclick = detachTab
document.querySelector('#undo-btn').onclick = undoTab
document.querySelector('#close-cur-btn').onclick = closeCurTab

refreshPage()
