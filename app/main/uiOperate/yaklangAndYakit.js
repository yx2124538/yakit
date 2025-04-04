const {ipcMain, app} = require("electron")
const fs = require("fs")
const https = require("https")
const {getLocalYaklangEngine} = require("../filePath")
const {
    fetchLatestYakEngineVersion,
    fetchLatestYakitEEVersion,
    fetchLatestYakitVersion,
    fetchLatestYakitIRifyVersion,
    fetchLatestYakitIRifyEEVersion,
    getAvailableOSSDomain,
    fetchSpecifiedYakVersionHash
} = require("../handlers/utils/network")
const childProcess = require("child_process")
const {testEngineAvaiableVersion} = require("../ipc")

module.exports = (win, getClient) => {
    ipcMain.handle("get-available-oss-domain", async () => {
        return await getAvailableOSSDomain()
    })

    /** yaklang引擎是否安装 */
    ipcMain.handle("is-yaklang-engine-installed", () => {
        /** @returns {Boolean} */
        return fs.existsSync(getLocalYaklangEngine())
    })

    /** 获取Yaklang引擎最新版本号 */
    const asyncFetchLatestYaklangVersion = () => {
        return new Promise((resolve, reject) => {
            fetchLatestYakEngineVersion()
                .then((version) => {
                    resolve(`${version}`.trim())
                })
                .catch((err) => {
                    reject(err)
                })
        })
    }
    /** 获取Yaklang引擎最新版本号 */
    ipcMain.handle("fetch-latest-yaklang-version", async (e) => {
        return await asyncFetchLatestYaklangVersion()
    })

    /** 获取Yakit最新版本号 */
    const asyncFetchLatestYakitVersion = (params) => {
        const {config, releaseEditionName} = params
        return new Promise((resolve, reject) => {
            const versionFetchers = {
                Yakit: fetchLatestYakitVersion,
                EnpriTrace: fetchLatestYakitEEVersion,
                IRify: fetchLatestYakitIRifyVersion,
                "IRify-EnpriTrace": fetchLatestYakitIRifyEEVersion
            }
            const fetchPromise = versionFetchers[releaseEditionName]
                ? versionFetchers[releaseEditionName]
                : fetchLatestYakitVersion
            fetchPromise(config)
                .then((version) => {
                    resolve(version)
                })
                .catch((e) => {
                    reject(e)
                })
        })
    }
    /** 获取Yakit最新版本号 */
    ipcMain.handle("fetch-latest-yakit-version", async (e, params) => {
        return await asyncFetchLatestYakitVersion(params)
    })

    /** 获取Yakit本地版本号 */
    ipcMain.handle("fetch-yakit-version", async (e) => {
        return app.getVersion()
    })

    /** 以更新引擎但未关闭内存中的老版本引擎进程(mac) */
    ipcMain.handle("kill-old-engine-process", (e, type) => {
        win.webContents.send("kill-old-engine-process-callback", type)
    })

    /** 获取Yaklang所有版本 */
    const asyncFetchYaklangVersionList = async () => {
        return new Promise(async (resolve, reject) => {
            const domain = await getAvailableOSSDomain()
            let rsp = https.get(`https://${domain}/yak/version-info/active_versions.txt`)
            rsp.on("response", (rsp) => {
                rsp.on("data", (data) => {
                    resolve(Buffer.from(data).toString("utf8"))
                }).on("error", (err) => reject(err))
            })
            rsp.on("error", reject)
        })
    }
    /** 获取Yaklang所有版本 */
    ipcMain.handle("fetch-yaklang-version-list", async (e) => {
        return await asyncFetchYaklangVersionList()
    })

    /** 校验Yaklang来源是否正确 */
    ipcMain.handle("fetch-check-yaklang-source", async (e, version, requestConfig) => {
        return await fetchSpecifiedYakVersionHash(version, requestConfig)
    })

    // 获取有效的引擎启动端口
    const asyncGetAvaiablePort = (params) => {
        return new Promise((resolve, reject) => {
            childProcess.execFile(
                getLocalYaklangEngine(),
                ["get-random-port", "-type", "tcp", "-json"],
                (err, stdout, stderr) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    if (stderr) {
                        reject(stderr)
                        return
                    }

                    try {
                        // 处理干扰符号：去除前后空格/换行
                        const cleanedOutput = stdout.trim()
                        const result = JSON.parse(cleanedOutput)
                        resolve(result.port)
                    } catch (parseError) {
                        reject(parseError)
                    }
                }
            )
        })
    }
    ipcMain.handle("get-avaiable-port", async (e, params) => {
        return await asyncGetAvaiablePort(params)
    })

    // 获取运行引擎的适配版本
    ipcMain.handle("determine-adapted-version-engine", async (e, params) => {
        return await testEngineAvaiableVersion(params)
    })
}
