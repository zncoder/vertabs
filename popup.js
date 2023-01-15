document.querySelector('#sidebar-btn').onclick = () => {
  browser.sidebarAction.toggle()
  window.close()
}
