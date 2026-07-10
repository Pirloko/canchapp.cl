(function () {
  function scrollToDemo() {
    const el = document.getElementById('demo')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  document.querySelectorAll('[data-scroll-demo]').forEach((btn) => {
    btn.addEventListener('click', scrollToDemo)
  })

  document.querySelectorAll('.faq-item__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item')
      if (!item) return
      const open = item.classList.contains('is-open')
      document.querySelectorAll('.faq-item').forEach((el) => el.classList.remove('is-open'))
      if (!open) item.classList.add('is-open')
    })
  })

  const form = document.getElementById('demo-form')
  const success = document.getElementById('demo-success')
  const successName = document.getElementById('demo-success-name')

  if (form && success && successName) {
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const nombre = /** @type {HTMLInputElement | null} */ (
        document.getElementById('demo-nombre')
      )
      const name = nombre?.value.trim() || 'gracias'
      successName.textContent = name
      form.hidden = true
      success.classList.add('is-visible')
    })
  }
})()
