
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

class Index {

    constructor() {
        this.appWindow = new BrowserWindow({width: 800, height: 600, show: false});
        this.appWindow.loadFile(__dirname + "/index.html");
        this.appWindow.webContents.openDevTools();

        this.httpService = new HttpService();
        this.previousRawResult = null;
        this.tooltip = "";
        this.menu = null;
        this.tray = null;
        this.startTimeInMinutes = 8 * 60 + 50;  // fetching starts at 8:50
        this.endTimeInMinutes = 17 * 60 + 10;   // fetching ends at 17:10

        this.fetchTimer = null;

        this.appWindow.on("ready-to-show", this.fetchRates.bind(this));
        this.appWindow.on("close", this.close.bind(this));
        app.on("window-all-closed", () => app.quit());

        ipcMain.on("tray-icon", this.updateTrayIcon.bind(this));
    }

    close() {
        clearTimeout(this.fetchTimer);
    }

    async fetchRates() {
        await this.tryFetchRates();
        this.scheduleNextFetch();
    }

    async tryFetchRates() {
        try {
            if (this.previousRawResult) {
                const now = moment();
                const todayInMinutes = now.hour() * 60 + now.minute();
                const isWeekend = now.day() === 0 || now.day() === 6;
                if (todayInMinutes < this.startTimeInMinutes || todayInMinutes > this.endTimeInMinutes || isWeekend) {
                    // let's wait until the next day starts
                    // but keep scheduling, since the clock may be readjusted and we don't want to miss the next window
                    return;
                }
            }

            const rawResult = await this.httpService.getText(REQUEST_URL);

            if (rawResult === this.previousRawResult) {
                // current result is the same as before; nothing to do
                return;
            }

            // something's changed; let's update the tray icon and menu context
            const result = JSON.parse(rawResult);
            const points = /** @type {DataPoint[]} */ result[1];

            if (!(Array.isArray(points) && points.length > 0)) {
                // no data points; bail out
                return;
            }

            const dollar = point => point.ask.toFixed(4);
            const time = point => moment(point.ts).format("HH:mm");
            const dataPointToStr = point => `${time(point)}     R$ ${dollar(point)}`;
            const latest = points[points.length - 1];
            this.appWindow.webContents.send("dollar", points);
            this.tooltip = dataPointToStr(latest);
            /** @type {Object[]} */
            const menuTemplate = points
                .slice(-16)  // latest 16 only
                .map(dataPointToStr)  // stringify
                .map(str => {
                    return {label: str};
                })  // make menu sub item
                .reverse();
            menuTemplate.push({type: "separator"});
            menuTemplate.push({label: `High      R$ ${parseFloat(result[2].high).toFixed(4)}`});
            menuTemplate.push({label: `Low       R$ ${parseFloat(result[2].low).toFixed(4)}`});
            menuTemplate.push({type: "separator"});
            menuTemplate.push({
                label: "About",
                click: () => shell.openExternal("https://github.com/luciopaiva/cambio")
            });
            menuTemplate.push({label: "Quit", click: () => app.quit()});
            this.menu = Menu.buildFromTemplate(menuTemplate);
            this.previousRawResult = rawResult;

        } catch (e) {
            // no problem, will try again in a minute
        }
    }

    scheduleNextFetch() {
        if (this.fetchTimer) {
            clearTimeout(this.fetchTimer);
        }
        this.fetchTimer = setTimeout(this.fetchRates.bind(this), 60000);
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

app.on("ready", () => new Index());
