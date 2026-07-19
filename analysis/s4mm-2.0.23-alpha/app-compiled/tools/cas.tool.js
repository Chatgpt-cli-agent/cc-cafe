"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolCas = void 0;
const electron_1 = require("electron");
class ToolCas {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-cas", async (event, data) => {
            switch (data.action) {
                case "filter":
                    return await this.filterCasElements(data.filter);
                case "get-cas-part-delet-info":
                    return await this.getCasPartDeletInfo(data.inos);
                default:
                    throw new Error(`Unknown action: ${data.action}`);
            }
        });
    }
    async filterCasElements(filter) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex) {
            throw new Error("Database connection is not available.");
        }
        let sel = ["CasPart.id", "CasPart.propId", knex.raw("CAST(CasPart.ino as TEXT) as ino"), "CasPart.swatch", "CasPart.instance", "CasPart.age", "CasPart.gender", "CasPart.body", "CasPart.primSort", "CasPart.sortLayer",];
        let list = [];
        let req = knex.from("CasPart").select(sel).where((qb) => {
            //Gender
            if (filter.cas_gender == 1) {
                qb.whereLike("gender", "%" + "[Male]" + "%");
            }
            else if (filter.cas_gender == 2) {
                qb.whereLike("gender", "%" + "[Female]" + "%");
            }
            qb.whereLike("age", "%" + "[ADULT]" + "%");
            //Categorie (Hat,Tops etc...)
            if (filter.cas_body == 1 || filter.cas_body == 2) {
                //Only Top
                if (filter.cas_cat == 0) {
                    qb.whereLike("body", "%" + "[T" + filter.cas_body + "]" + "%");
                }
                else if (filter.cas_cat_sub == 0) {
                    qb.whereLike("body", "%" + "[T" + filter.cas_body + "]-[M" + filter.cas_cat + "]" + "%");
                }
                else {
                    qb.whereLike("body", "%" + "[T" + filter.cas_body + "]-[M" + filter.cas_cat + "]-[B" + filter.cas_cat_sub + "]" + "%");
                }
            }
        });
        /*//Extra Options
        if (filter && filter.s_active == true) {
            req.andWhereLike("name", "%" + ".package");
        }
        if (filter && filter.s_deactive == true) {
            req.andWhereLike("name", "%" + ".packageOFF");
        }*/
        list = await req;
        return { list, error: false };
    }
    async getCasPartDeletInfo(inos) {
        let result = {
            error: true,
            msg: "Unknown error!",
        };
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        if (!inos)
            return result;
        let files = await knex.from("Files").whereIn("ino", inos).select(["*", knex.raw("CAST(ino as TEXT) as ino")]);
        let casParts = await knex.from("CasPart").whereIn("ino", inos).select(["*", knex.raw("CAST(ino as TEXT) as ino")]);
        result.error = false;
        result.files = files;
        result.casParts = casParts;
        return result;
    }
}
exports.ToolCas = ToolCas;
