const electron = require('electron')

// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
// Module to create tray items.
const Tray = electron.Tray
// Module to create Menus.
const Menu = electron.Menu

const globalShortcut = electron.globalShortcut

const path = require('path')
const url = require('url')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function registerTray () {
  // tray = new Tray()
  // const contextMenu = Menu.buildFromTemplate([
  //   { label: 'Click me', type: 'radio'}
  // ])
  // tray.setTooltip('YouTube to Serato')
  // tray.setContextMenu(contextMenu)
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
    // skipTaskbar: true,
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
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
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
