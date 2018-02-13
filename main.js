const electron = require('electron')
const settings = require('electron-settings')

// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const Tray = electron.Tray
const Menu = electron.Menu
const globalShortcut = electron.globalShortcut
const dialog = electron.dialog
const ipcMain = electron.ipcMain

const fs = require('fs')
const path = require('path')
const url = require('url')
const rimraf = require('rimraf')

const tmpDir = `${require('os').tmpdir()}\\serato-yt`

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
global.mainWindow = null

// Ditto for the tray
global.tray = null

function registerTray () {
  global.tray = new Tray('./serato-yt.ico')
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open download location', type: 'normal', click: openDownloadLocation },
    { label: 'Set default download location', type: 'normal', click: setDownloadLocation },
    { type: 'separator' },
    { label: 'Set drop point for import', type: 'normal', click: setDropLocation },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])
  global.tray.setToolTip('Serato YouTube Importer')
  global.tray.setContextMenu(contextMenu)
}

function openDownloadLocation () {
  exec(`start "" "${settings.get('user.dlpath')}"`)
}

function setDownloadLocation () {
  const location = dialog.showOpenDialog({ properties: ['openDirectory'], defaultPath: settings.get('user.dlpath') })
  if (location) {
    settings.set('user.dlpath', location[0])
  }
}

function setDropLocation () {
  const current = settings.get('user.dropcoord')
  if (dialog.showMessageBox({
    type: 'info',
    title: 'Set drop point',
    message: `Currently set to (${current.x},${current.y}).\n\nAfter clicking "OK", please hold your mouse on your Serato library inside of the Serato application. This is where Serato YouTube Importer will drop the MP3s it downloads, much as you would by hand. Your location will be recorded after three seconds.`,
    buttons: ['OK', 'Cancel']
  }) == 0) {
    setTimeout(() => {
      const pt = electron.screen.getCursorScreenPoint()
      dialog.showMessageBox({
        type: 'info',
        title: 'Drop location saved!',
        message: `Drop location saved at (${pt.x},${pt.y}).`
      })
      settings.set('user.dropcoord', pt)
    }, 3000)
  }
}

function createWindow () {
  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize

  // Create the browser window.
  global.mainWindow = new BrowserWindow({
    title: 'Serato YouTube Importer',
    icon: './serato-yt.ico',

    width: Math.ceil(width * 0.75),
    height: Math.ceil(height * 0.67),
    center: true,

    frame: false,
    transparent: true,
    toolbar: false,
    movable: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: 'hidden',
    thickFrame: false,
    // skipTaskbar: true,
})

  // and load the index.html of the app.
  global.mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // global.mainWindow.webContents.openDevTools({ detach: true })

  // Emitted when the window is closed.
  global.mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    global.mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // Set defaults if not set
  if (!settings.has('user.dlpath')) {
    settings.set('user.dlpath', tmpDir)
  }
  if (!fs.existsSync(tmpDir)){
    fs.mkdirSync(tmpDir)
  }
  console.log('Loaded settings')
  console.log(settings.getAll())

  // Register stuff with the OS
  const ret = globalShortcut.register('CommandOrControl+Alt+D', () => {
    global.mainWindow.show()
    global.mainWindow.webContents.executeJavaScript('document.querySelector("input").focus()')
  })
  registerTray()
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
  if (global.mainWindow == null) {
    createWindow()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  global.tray = null
  rimraf.sync(tmpDir)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
const download = require('./download')
const { exec, execSync } = require('child_process')

let latestFilepath

ipcMain.on('video', (_, url) => {
  download(url, settings.get('user.dlpath'), (percentage) => {
    global.mainWindow.webContents.send('dl-progress', percentage)
  }, new Promise((_, reject) => {
    ipcMain.once('cancel', reject)
  })).then(filepath => {
    // global.tray.once('balloon-click', () => {
    //   global.mainWindow.show()
    // })
    // global.tray.displayBalloon({
    //   title: 'Download ready for import.',
    //   content: 'Click here or press Ctrl+Alt+D to open.'
    // })
    ipcMain.removeAllListeners('cancel')
    global.mainWindow.webContents.send('dl-complete')
    latestFilepath = filepath
  })
})

ipcMain.on('import', () => {
  if (latestFilepath) {
    execSync('autohotkey.exe pre.ahk')
    exec(`explorer.exe /select, "${latestFilepath}"`)
    const { x, y } = settings.get('user.dropcoord')
    execSync(`autohotkey.exe post.ahk ${x} ${y}`)
  }
})

ipcMain.on('resize', (_, width, height) => {
  global.mainWindow.setSize(width, height)
})
