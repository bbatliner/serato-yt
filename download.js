const fs = require('fs')
const ffmpeg = require('fluent-ffmpeg')
const ytdl = require('ytdl-core')
const sllog = require('single-line-log').stdout

module.exports = function download (url, progressCb, cancelPromise) {
  const opts = {
    filter: 'audioonly',
    quality: 'highestaudio',
    retries: 2
  }

  const reader = ytdl(url, opts)
    .on('info', (info, format) => {
      console.log(`Metadata fetched: ${info.title} (id:${info.vid})`)
    })
    .on('response', (resp) => {
      if (resp.statusCode === 200) {
        console.log('Starting download...')
      } else {
        console.log(`Non-200 status code: ${resp.statusCode}`)
      }
    })
    .on('progress', (len, progress, total) => {
      const percentage = Math.floor(100 * progress / total)
      if (percentage !== 0) {
        sllog(`${percentage}% complete (${progress} of ${total} bytes)`)
      }
      progressCb(percentage)
    })
    .on('end', () => {
      console.log() // advance the sllog
    })
    .on('error', (err) => {
      console.error('Could not download:', err)
    })

  const writer = ffmpeg(reader)
    .format('mp3')
    .audioBitrate(192)
    .on('start', (cmd) => {
      console.log('Spawned ffmpeg with command:', cmd)
    })
    .on('end', () => {
      console.log('Transcoding succeeded!')
    })
    .on('error', (err) => {
      console.error('ffmpeg error:', err)
    })

  const metadataPromise = new Promise((resolve, reject) => {
    reader.on('info', resolve)
    reader.on('error', reject)
  })

  const filePromise = metadataPromise.then(metadata => {
    const filepath = `mp3s\\${metadata.title.replace(/"/g, '').replace(/\(/g, '').replace(/\)/g, '').replace(/\?/g, '').replace(/\./g, '').replace(/\|/g, '').replace('  ', ' ').replace(/\,/g, '')}.mp3`
    writer.output(fs.createWriteStream(filepath)).run()
    return new Promise((resolve, reject) => {
      writer.on('end', () => {
        resolve(filepath)
      })
      writer.on('err', reject)
    })
  })

  cancelPromise.catch(() => {
    console.log()
    console.log('Received cancel...')
    reader.destroy()
    writer.kill()
  })

  return filePromise
}
