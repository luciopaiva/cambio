
const
    {app, BrowserWindow, Tray, nativeImage, Menu, ipcMain, shell} = require('electron'),
    moment = require("moment"),
    HttpService = require("./http-service");

const REQUEST_URL = "https://cotacoes.economia.uol.com.br/cambioJSONChart.html?type=d&cod=BRL&mt=off";

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
        this.previousRawResult = null;
        this.tooltip = "";
        this.menu = null;
        this.tray = null;

        this.fetchTimer = null;

        this.appWindow.on("ready-to-show", this.fetchDollar.bind(this));
        this.appWindow.on("close", this.close.bind(this));
        app.on("window-all-closed", () => app.quit());

        ipcMain.on("tray-icon", this.updateTrayIcon.bind(this));
    }

    close() {
        clearTimeout(this.fetchTimer);
    }

    async fetchDollar() {
        try {
            const rawResult = await this.httpService.getText(REQUEST_URL);

            if (rawResult !== this.previousRawResult) {  // something's changed; let's update the tray icon and menu context
                const result = JSON.parse(rawResult);
                const points = /** @type {DataPoint[]} */ result[1];

                if (Array.isArray(points) && points.length > 0) {
                    const dollar = point => point.ask.toFixed(4);
                    const time = point => moment(point.ts).format("HH:mm");
                    const dataPointToStr = point => `${time(point)}     R$ ${dollar(point)}`;

                    const latest = points[points.length - 1];
                    // request that the browser window generates a new tray icon image for us
                    this.appWindow.webContents.send("dollar", points);

                    this.tooltip = dataPointToStr(latest);

                    /** @type {Object[]} */
                    const menuTemplate = points
                        .slice(-16)  // latest 16 only
                        .map(dataPointToStr)  // stringify
                        .map(str => { return { label: str }; })  // make menu sub item
                        .reverse();  // most recent on top

                    menuTemplate.push({ type: "separator" });
                    menuTemplate.push({ label: `High      R$ ${parseFloat(result[2].high).toFixed(4)}`});
                    menuTemplate.push({ label: `Low       R$ ${parseFloat(result[2].low).toFixed(4)}`});

                    menuTemplate.push({ type: "separator" });
                    menuTemplate.push({ label: "About", click: () => shell.openExternal("https://github.com/luciopaiva") });
                    menuTemplate.push({ label: "Quit", click: () => app.quit() });

                    this.menu = Menu.buildFromTemplate(menuTemplate);

                    // it was a good response, so cache it
                    this.previousRawResult = rawResult;
                }
            }
        } catch (e) {
            // no problem, will try again in a minute
        }

        this.fetchTimer = setTimeout(this.fetchDollar.bind(this), 60000);
    }

    updateTrayIcon(sender, iconDataUrl) {
        const image = nativeImage.createFromDataURL(iconDataUrl);
        if (this.tray) {
            this.tray.setImage(image);
        } else {
            this.tray = new Tray(image);
        }
        this.tray.setToolTip(this.tooltip);
        this.tray.setContextMenu(this.menu);
    }
}

app.on("ready", () => new CotacaoUol());
