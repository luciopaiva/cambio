
const
    {app, BrowserWindow, Tray, nativeImage, ipcMain} = require('electron'),
    moment = require("moment"),
    HttpService = require("./http-service");

/**
 * @typedef {Object} DataPoint
 * @property {Number} ask
 * @property {Number} ts
 */

class CotacaoUol {

    constructor() {
        this.appWindow = new BrowserWindow({width: 800, height: 600, show: false});
        this.appWindow.loadFile(__dirname + "/index.html");
        this.appWindow.webContents.openDevTools();

        this.httpService = new HttpService();

        this.tray = null;

        this.fetchTimer = null;

        this.appWindow.on("ready-to-show", this.fetchDollar.bind(this));
        this.appWindow.on("close", this.close.bind(this));

        ipcMain.on("tray-icon", this.updateTrayIcon.bind(this));
    }

    close() {
        clearTimeout(this.fetchTimer);
    }

    async fetchDollar() {
        // ToDo download new dollar conversion rate

        const rawResult = await this.httpService.getText("https://cotacoes.economia.uol.com.br/cambioJSONChart.html?type=d&cod=BRL&mt=off");
        // const jsonStr = rawResult.replace(/.*grafico\.parseData\((.*?)\);.*/, "$1");
        const result = JSON.parse(rawResult);

        // console.info(JSON.stringify(result, null, 2));

        const dollar = point => point.ask.toFixed(4);
        const time = point => moment(point.ts).format("HH:mm");

        const points = /** @type {DataPoint[]} */ result[1];
        if (Array.isArray(points) && points.length > 0) {
            for (const point of points) {
                console.info(`R$ ${dollar(point)} at ${time(point)}`);
            }

            const latest = points[points.length - 1];
            this.appWindow.webContents.send("dollar", dollar(latest), time(latest));
        }

        this.fetchTimer = setTimeout(this.fetchDollar.bind(this), 10000);
    }

    updateTrayIcon(sender, iconDataUrl) {
        const image = nativeImage.createFromDataURL(iconDataUrl);
        if (this.tray) {
            this.tray.setImage(image);
        } else {
            this.tray = new Tray(image);
        }
    }
}

app.on("ready", () => new CotacaoUol());


function run() {
    // tray.on('click', () => {
    //     win.isVisible() ? win.hide() : win.show()
    // });
    // win.on('show', () => {
    //     tray.setHighlightMode('always')
    // });
    // win.on('hide', () => {
    //     tray.setHighlightMode('never')
    // });
}
