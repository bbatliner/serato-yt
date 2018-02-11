// Query youtube on debounced inputs
const input = document.querySelector('input')
input.addEventListener('input', debounce(() => {
  if (input.value.length === 0) {
    renderVideos([])
    return
  }
  const videosPromise = fetch(`https://content.googleapis.com/youtube/v3/search?q=${input.value}&maxResults=10&part=snippet&key=AIzaSyDe6ZIrhziaGm8qU-piNurQXyBfBffzdHY`)
    .then(resp => resp.json())
    .then(jsonToVideos)
  const durationsPromise = videosPromise.then(videos => {
    const ids = videos.map(video => video.videoId).join(',')
     return fetch(`https://www.googleapis.com/youtube/v3/videos?id=${ids}&part=contentDetails&key=AIzaSyDe6ZIrhziaGm8qU-piNurQXyBfBffzdHY`)
      .then(resp => resp.json())
      .then(data => {
        const durations = jsonToDurations(data)
        durations.forEach(duration => {
          videos.find(video => video.videoId === duration.videoId).duration = duration.duration
        })
      })
  })
  Promise.all([videosPromise, durationsPromise]).then(([videos]) => {
    renderVideos(videos)
  })
}, 325))

function jsonToVideos (json) {
  return json.items.map(item => ({
    videoId: item.id.videoId,
    channelTitle: item.snippet.channelTitle,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails.medium
  }))
}

function jsonToDurations (json) {
  return json.items.map(item => ({
    videoId: item.id,
    duration: parseDuration(item.contentDetails.duration)
  }))
}

const progress = document.getElementById('progress')

const resultsList = document.getElementById('results')
function renderVideos (videos) {
  for (let i = 0; i < resultsList.children.length; i++) {
    resultsList.children[i].style.animationDuration = '0.3s'
    resultsList.children[i].style.animationTimingFunction = 'ease-in-out'
    resultsList.children[i].style.animationName = 'fadeout'
    ;(el => {
      el.addEventListener('animationend', () => {
        resultsList.removeChild(el)
      })
    })(resultsList.children[i])
  }
  let fadeInDuration = 0.2
  videos.forEach(video => {
    const html = [
      '<div class="result-container">',
        `<li class="result" style="height: ${video.thumbnail.height}px; animation: fadein ${fadeInDuration += 0.37}s;">`,
          '<div class="result__thumbnail">',
            `<img src="${video.thumbnail.url}" width=${video.thumbnail.width} height=${video.thumbnail.height}>`,
          '</div>',
          `<div class="result__text" style="width: calc(100% - 16px - ${video.thumbnail.width}px); height: ${video.thumbnail.height}px">`,
            `<h2 class="result__title">${video.title}</h2>`,
            `<h3 class="result__channel">${video.channelTitle}</h3>`,
            `<p class="result__description">${video.description}</p>`,
          '</div>',
          '<div class="result__overlay"><i class="fa fa-cloud-download-alt"></i></div>',
        '</li>',
      '</div>'
    ].join('')
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    const videoEl = wrapper.firstChild.firstChild
    let dlInProgress = false
    videoEl.addEventListener('click', (e) => {
      if (e.target !== progress && !progress.contains(e.target) && !dlInProgress) {
        dlInProgress = true
        showDownloadView(videoEl)
        require('electron').remote.app.emit('video', `https://www.youtube.com/watch?v=${video.videoId}`)
        require('electron').ipcRenderer.on('dl-progress', (_, percentage) => {
          document.querySelector('progress').value = percentage
        })
        require('electron').ipcRenderer.on('dl-complete', () => {
          dlInProgress = false
          importBtn.removeAttribute('disabled')
          cancelBtn.textContent = 'Back'
        })
      }
    })
    resultsList.appendChild(wrapper.firstChild)
  })
}

const cancelBtn = document.getElementById('cancel')
cancelBtn.addEventListener('click', () => {
  if (importBtn.disabled) {
    require('electron').remote.app.emit('cancel')
  }
  backToNormalView()
})

const importBtn = document.getElementById('import')
importBtn.addEventListener('click', () => {
  setTimeout(() => require('electron').remote.app.emit('import'), 400)
  importBtn.addEventListener('animationend', function once () {
    importBtn.removeEventListener('animationend', once)
    setTimeout(() => importBtn.classList.remove('button--moema-anim'), 400)
  })
  importBtn.classList.add('button--moema-anim')
})

function showDownloadView (videoEl) {
  progress.parentNode.removeChild(progress)
  const correctWidth = window.getComputedStyle(videoEl).getPropertyValue('width')
  videoEl.appendChild(progress)
  videoEl.style.transition = 'none'
  videoEl.style.top = `${videoEl.getBoundingClientRect().top}px`
  videoEl.style.width = correctWidth
  progress.style.width = `${parseFloat(correctWidth) - 3}px`
  document.body.classList.add('download')
  videoEl.parentNode.classList.add('download')
  setTimeout(() => { videoEl.style.transition = ''; videoEl.style.top = 0 }, 200)
}

function backToNormalView () {
  cancelBtn.textContent = 'Cancel'
  importBtn.setAttribute('disabled', true)
  document.querySelector('progress').value = 0
  document.body.classList.remove('download')
  const toDownload = document.querySelector('.download')
  toDownload.style.width = ''
  toDownload.classList.remove('download')
  progress.style.width = ''
  progress.parentNode.removeChild(progress)
  document.body.appendChild(progress)
}

const isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/
function parseDuration (isoDuration) {
  const match = isoRegex.exec(isoDuration)
  const sign = (match[1] === '-') ? -1 : (match[1] === '+') ? 1 : 1
  return {
    y: parseIso(match[2], sign),
    M: parseIso(match[3], sign),
    w: parseIso(match[4], sign),
    d: parseIso(match[5], sign),
    h: parseIso(match[6], sign),
    m: parseIso(match[7], sign),
    s: parseIso(match[8], sign)
  }
}
function parseIso (inp, sign) {
  // We'd normally use ~~inp for this, but unfortunately it also
  // converts floats to ints.
  // inp may be undefined, so careful calling replace on it.
  var res = inp && parseFloat(inp.replace(',', '.'));
  // apply sign while we're at it
  return (isNaN(res) ? 0 : res) * sign;
}

function getPosition(element) {
    var xPosition = 0;
    var yPosition = 0;

    while(element) {
        xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
        yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
        element = element.offsetParent;
    }

    return { x: xPosition, y: yPosition };
}

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};
