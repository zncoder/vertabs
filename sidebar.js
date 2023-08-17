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

async function stickTab(ev) {
  let [t] = await browser.tabs.query({active: true, currentWindow: true})
  if (!t.autoDiscardable) {
    await browser.tabs.update(t.id, {autoDiscardable: true})
    refreshPage()
  } else {
    await browser.tabs.update(t.id, {autoDiscardable: false})
    // move will refresh the page
    await browser.tabs.move(t.id, {index: 0})
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
  browser.tabs.duplicate(tab.id)
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

async function onCreated(t) {
  // move will refresh the page
  let sticky = await browser.tabs.query({currentWindow: true, autoDiscardable: false})
  await browser.tabs.move(t.id, {index: sticky.length})
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

for (let ev of [
  browser.tabs.onActivated,
  browser.tabs.onAttached,
  browser.tabs.onMoved,
  browser.tabs.onReplaced,
  browser.tabs.onUpdated,
  browser.tabs.onDetached,
]) {
  ev.addListener(refreshPage)
}

unpinAll()
refreshPage()
