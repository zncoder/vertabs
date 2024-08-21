function renderTemplate(tmpl, obj) {
	let s = tmpl
	for (let [k, v] of Object.entries(obj)) {
		if (!Array.isArray(v)) {
			s = s.replace(new RegExp(`{{${k}}}`, 'g'), v)
		} else {
			let begin = s.indexOf(`{{begin_${k}}}`)
			if (begin < 0) {
				console.error(`{{begin_${k}}} not found`)
				return s
			}
			let a = begin + `{{begin_${k}}}`.length
			let end = s.indexOf(`{{end_${k}}}`)
			if (end < 0) {
				console.error(`{{end_${k}}} not found`)
				return s
			}
			let b = end
			end += `{{end_${k}}}`.length
			let t = renderArrayTemplate(s.substring(a, b), v)
			s = s.substring(0, begin) + t + s.substring(end)
		}
	}
	return s.replace(/{{.*?}}/g, '')
}

function renderArrayTemplate(tmpl, array) {
	let s = ''
	for (let v of array) {
		s += renderTemplate(tmpl, v)
	}
	return s
}

function stripHTMLTags(s) {
	let el = document.createElement('div')
	el.innerHTML = s
	return el.textContent
}
