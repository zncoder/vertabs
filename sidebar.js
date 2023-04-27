const isPopup = window.location.href.endsWith('popup')
const tabsDiv = document.querySelector('#tabs-div')
let pinnedUl = document.querySelector('#pinned-ul')
let othersUl = document.querySelector('#others-ul')

async function buildTabList() {
  let pinned = []
  let others = []
  let tabs = await browser.tabs.query({currentWindow: true})
  for (let t of tabs) {
    if (t.pinned) {
      pinned.push(t)
    } else {
      others.push(t)
    }
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

async function refreshPage() {
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

async function pinTab(ev) {
  let [t] = await browser.tabs.query({active: true, currentWindow: true})
  if (t.pinned) {
    await browser.tabs.update(t.id, {pinned: false})
    refreshPage()
  } else {
    await browser.tabs.update(t.id, {pinned: true})
    // move will refresh the page
    await browser.tabs.move(t.id, {index: 0})
  }
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

async function onCreated(t) {
  // move will refresh the page
  let pinned = await browser.tabs.query({currentWindow: true, pinned: true})
  await browser.tabs.move(t.id, {index: pinned.length})
}

browser.tabs.onCreated.addListener(onCreated)

for (let ev of [
  browser.tabs.onActivated,
  browser.tabs.onAttached,
  browser.tabs.onMoved,
  browser.tabs.onReplaced,
  browser.tabs.onUpdated,
  browser.tabs.onRemoved,
  browser.tabs.onDetached,
]) {
  ev.addListener(refreshPage)
}

refreshPage()
