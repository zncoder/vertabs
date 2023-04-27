const isPopup = window.location.href.endsWith('popup')
const tabsDiv = document.querySelector('#tabs-div')
let pinnedUl = document.querySelector('#pinned-ul')
let othersUl = document.querySelector('#others-ul')
let pinnedTabs // tab.pinned is not used

function cmpTabs(choice, ta, tb) {
  let ai = pinnedTabs.findIndex(x => x === ta.id)
  let bi = pinnedTabs.findIndex(x => x === tb.id)
  if (ai >= 0 !== bi >= 0) {
    return ai >= 0 ? -1 : 1
  } else if (ai >= 0) {
    return ai - bi
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
  let pinned = []
  let others = []
  let news = []
  let cur
  for (let t of tabs) {
    if (pinnedTabs.find(x => x === t.id)) {
      pinned.push(t)
    } else if (t.title.startsWith('New Tab') && (t.url === 'about:newtab' || t.url.startsWith('moz-extension://'))) {
      news.push(t)
    } else if (t.active) {
      cur = t
    } else {
      others.push(t)
    }
  }

  pinned.sort((ta, tb) => ta.index - tb.index)

  // let options = await browser.storage.local.get('sortChoice')
  // let choice = options.sortChoice ? options.sortChoice : 'last-access'

  // place new tabs first
  if (news.length > 0) {
    news.sort((ta, tb) => tb.lastAccessed - ta.lastAccessed)
  }
  if (others.length > 0) {
    others.sort((ta, tb) => tb.lastAccessed - ta.lastAccessed)
  }
  others.splice(0, 0, ...news)
  // insert cur to its position, so that it doesn't move
  if (cur) {
    let i = cur.index - pinned.length
    others.splice(i, 0, cur)
  }

  if (others.length > 0) {
    let tids = []
    for (let t of others) {
      tids.push(t.id)
    }
    await browser.tabs.move(tids, {index: pinned.length})
  }
  return [renderTabs(pinned, 'pinned-ul'), renderTabs(others, 'others-ul')]
}

function renderTabs(tabs, cls) {
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
    li.innerHTML = `
<span id='c-${t.id}' class='close-btn' title='close'>&nbsp;⨯&nbsp;</span><span class='tab-lnk' id='t-${t.id}' title='${t.title} - ${t.url}'>${img}${t.title}</span>
`
    li.querySelector('.close-btn').onclick = closeThisTab
    li.onclick = focusThisTab
    li.onauxclick = closeThisTab
    ul.appendChild(li)
  }
  return ul
}

async function loadPinnedTabs() {
  pinnedTabs = []
  let win = await browser.windows.getCurrent()
  let key = `w-${win.id}`
  let obj = await browser.storage.local.get(key)
  let pinned = obj[key]
  if (pinned) {
    pinnedTabs = Array.from(pinned)
  }
}

async function savePinnedTabs() {
  let win = await browser.windows.getCurrent()
  if (win) {
    let obj = {}
    obj[`w-${win.id}`] = pinnedTabs
    // console.log('save pinned', obj)
    await browser.storage.local.set(obj)
  }
}

async function refreshPage() {
  if (pinnedTabs === undefined) {
    await loadPinnedTabs()
  }

  let [pinned, others] = await buildTabList()
  tabsDiv.replaceChild(pinned, pinnedUl)
  pinnedUl = pinned
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

function removeFromPinnedTabs(tid) {
  let i = pinnedTabs.findIndex(x => x === tid)
  if (i >= 0) {
    pinnedTabs.splice(i, 1)
  }
}

async function pinTab(ev) {
  let [tab] = await browser.tabs.query({active: true, currentWindow: true})
  if (pinnedTabs.find(x => x === tab.id)) {
    await browser.tabs.update(tab.id, {pinned: false})
    await browser.tabs.move(tab.id, {index: pinnedTabs.length})
    removeFromPinnedTabs(tab.id)
  } else {
    await browser.tabs.update(tab.id, {pinned: true})
    pinnedTabs.splice(0, 0, tab.id)
    await browser.tabs.move(tab.id, {index: 0})
  }
  savePinnedTabs()

  refreshPage()
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
  browser.tabs.duplicate(tab.id)
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
    // console.log(name, x)
    if (name === 'onRemoved' || name === 'onDetached') {
      removeFromPinnedTabs(x)
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

refreshPage()
