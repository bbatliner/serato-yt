const electron = require('electron')

// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const Tray = electron.Tray
const Menu = electron.Menu
const globalShortcut = electron.globalShortcut
const dialog = electron.dialog

const path = require('path')
const url = require('url')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

// Ditto for the tray
let tray

function registerTray () {
  tray = new Tray('./serato-yt.ico')
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show main window', type: 'normal', click () { mainWindow.show() } },
    { label: 'Open download location', type: 'normal', click: openDownloadLocation },
    { type: 'separator' },
    { label: 'Set default download location', type: 'normal', click: setDownloadLocation },
    { label: 'Set drop point for import', type: 'normal', click: setDropLocation },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])
  tray.setToolTip('Serato YouTube Importer')
  tray.setContextMenu(contextMenu)
}

// TODO: load these values from config at start

function openDownloadLocation () {

}

function setDownloadLocation () {
  const location = dialog.showOpenDialog({ properties: ['openDirectory'] })
  console.log(location)
  // TODO: save location
}

function setDropLocation () {
  // TODO: cancel button
  dialog.showMessageBox({
    type: 'info',
    title: 'Set drop point',
    message: 'After closing this message box, please hold your mouse on your Serato library inside of the Serato application. This is where Serato YouTube Importer will drop the MP3s it downloads, much as you would by hand. Your location will be recorded after three seconds.'
  })
  setTimeout(() => {
    const pt = electron.screen.getCursorScreenPoint()
    dialog.showMessageBox({
      type: 'info',
      title: 'Drop location saved!',
      message: `Drop location saved at (${pt.x},${pt.y}).`
    })
    // TODO: save location
  }, 3000)
}

function createWindow () {
  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: Math.ceil(width * 0.67),
    height: Math.ceil(height * 0.67),
    center: true,
    frame: false,
    transparent: true,
    toolbar: false,
    skipTaskbar: true,
    maximizable: false,
    fullscreenable: false
})

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  registerTray()
  const ret = globalShortcut.register('CommandOrControl+Alt+D', () => {
    mainWindow.show()
    mainWindow.webContents.executeJavaScript('document.querySelector("input").focus()')
  })
  createWindow()
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow == null) {
    createWindow()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  tray = null
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
const download = require('./download')
const { exec, execSync } = require('child_process')

let latestFilepath

app.on('video', (url) => {
  download(url, (percentage) => {
    mainWindow.webContents.send('dl-progress', percentage)
  }, new Promise((_, reject) => {
    app.on('cancel', reject)
  })).then(filepath => {
    // tray.once('balloon-click', () => {
    //   mainWindow.show()
    // })
    // tray.displayBalloon({
    //   title: 'Download ready for import.',
    //   content: 'Click here or press Ctrl+Alt+D to open.'
    // })
    mainWindow.webContents.send('dl-complete')
    latestFilepath = filepath
  })
})

app.on('import', () => {
  if (latestFilepath) {
    console.log(latestFilepath)
    execSync('autohotkey.exe pre.ahk')
    exec(`explorer.exe /select, ${latestFilepath}`)
    execSync('autohotkey.exe post.ahk')
  }
})
