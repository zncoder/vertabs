async function saveOptions() {
  let choice = document.querySelector('#sort-choice').value
  await browser.storage.local.set({sortChoice: choice})
  document.querySelector("#status").innerText = `${choice} saved`
}

document.querySelector("#save").onclick = saveOptions
