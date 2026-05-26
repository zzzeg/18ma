import NProgress from 'nprogress'

NProgress.configure({
  showSpinner: false,
  minimum: 0.08,
  easing: 'ease',
  speed: 360,
  trickleSpeed: 180,
})

let requestCount = 0
let routePending = false
let started = false

function startBar() {
  if (started) return
  NProgress.start()
  started = true
}

function stopBar() {
  if (!started) return
  NProgress.done()
  started = false
}

export function startRouteProgress() {
  routePending = true
  startBar()
}

export function doneRouteProgress() {
  routePending = false
  if (requestCount === 0) {
    stopBar()
  }
}

export function startRequestProgress() {
  requestCount += 1
  startBar()
}

export function doneRequestProgress() {
  requestCount = Math.max(0, requestCount - 1)
  if (requestCount === 0 && !routePending) {
    stopBar()
  }
}

export function resetProgress() {
  requestCount = 0
  routePending = false
  stopBar()
}
