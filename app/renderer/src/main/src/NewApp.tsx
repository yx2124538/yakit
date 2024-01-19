import React, {useRef, useEffect, useState, Suspense, lazy} from "react"
// by types
import {failed, warn, yakitFailed} from "./utils/notification"
import {useHotkeys} from "react-hotkeys-hook"
import {getCompletions} from "./utils/monacoSpec/yakCompletionSchema"
import {showModal} from "./utils/showModal"
import {YakCodeEditor} from "./utils/editors"
import {getRemoteValue, setRemoteValue} from "./utils/kv"
import {useGetState, useMemoizedFn} from "ahooks"
import {NetWorkApi} from "./services/fetch"
import {API} from "./services/swagger/resposeType"
import {useStore, yakitDynamicStatus} from "./store"
import {refreshToken} from "./utils/login"
import UILayout from "./components/layout/UILayout"
import {isCommunityEdition} from "@/utils/envfile"
import {LocalGV, RemoteGV} from "./yakitGV"
import {YakitModal} from "./components/yakitUI/YakitModal/YakitModal"
import styles from "./app.module.scss"
import {coordinate} from "./pages/globalVariable"
import {remoteOperation} from "./pages/dynamicControl/DynamicControl"
import {useTemporaryProjectStore} from "./store/temporaryProject"
import {ProjectDescription} from "./pages/softwareSettings/ProjectManage"
import {useRunNodeStore} from "./store/runNode"
import { visitorsStatisticsFun } from "./utils/visitorsStatistics"

/** 快捷键目录 */
const InterceptKeyword = [
    // "KeyA",
    // "KeyB",
    // "KeyC",
    "KeyD",
    "KeyE",
    // "KeyF",
    "KeyG",
    "KeyH",
    "KeyI",
    "KeyJ",
    "KeyK",
    "KeyL",
    // "KeyM",
    "KeyN",
    // "KeyO",
    // "KeyP",
    // "KeyQ",
    "KeyR",
    // "KeyS",
    "KeyT",
    // "KeyU",
    // "KeyV",
    "KeyW"
    // "KeyX",
    // "KeyY",
    // "KeyZ",
]
/** 部分页面懒加载 */
const Main = lazy(() => import("./pages/MainOperator"))

const {ipcRenderer} = window.require("electron")

interface OnlineProfileProps {
    BaseUrl: string
    Password?: string
    IsCompany?: boolean
}

function NewApp() {
    /** 是否展示用户协议 */
    const [agreed, setAgreed] = useState(false)
    /** 展示用户协议计时时间 */
    const [readingSeconds, setReadingSeconds, getReadingSeconds] = useGetState<number>(3)
    const agrTimeRef = useRef<any>(null)
    /** 私有域是否设置成功 */
    const [onlineProfileStatus, setOnlineProfileStatus] = useState<boolean>(false)

    // 全局记录鼠标坐标位置(为右键菜单提供定位)
    const coordinateTimer = useRef<any>(null)
    useEffect(() => {
        document.onmousemove = (e) => {
            const {screenX, screenY, clientX, clientY, pageX, pageY} = e
            if (coordinateTimer.current) {
                clearTimeout(coordinateTimer.current)
                coordinateTimer.current = null
            }
            coordinateTimer.current = setTimeout(() => {
                coordinate.screenX = screenX
                coordinate.screenY = screenY
                coordinate.clientX = clientX
                coordinate.clientY = clientY
                coordinate.pageX = pageX
                coordinate.pageY = pageY
            }, 50)
        }
    }, [])

    // 全局监听change事件 input & textrea 都去掉浏览器校验
    useEffect(() => {
        const handleInputEvent = (event) => {
            const { target } = event
            const isInput = target && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
            if (isInput) {
                const spellCheck = target.getAttribute("spellCheck")
                if (spellCheck || spellCheck === null) {
                    target.setAttribute("spellCheck", "false")
                }
            }
        }
        document.addEventListener('change', handleInputEvent)
        return () => {
            document.removeEventListener("change", handleInputEvent)
        }
    }, [])

    /** 是否展示用户协议 */
    useEffect(() => {
        ipcRenderer
            .invoke("fetch-local-cache", LocalGV.UserProtocolAgreed)
            .then((value: any) => {
                setAgreed(!!value)
                if (!value) {
                    if (agrTimeRef.current) clearInterval(agrTimeRef.current)
                    agrTimeRef.current = setInterval(() => {
                        setReadingSeconds(getReadingSeconds() - 1)
                        if (getReadingSeconds() === 0) {
                            clearInterval(agrTimeRef.current)
                            agrTimeRef.current = null
                        }
                    }, 1000)
                }
            })
            .catch(() => {})
    }, [])

    /** 全局拦截快捷键(补全内容) */
    useHotkeys("alt+a", (e) => {
        const a = getCompletions()
        showModal({
            title: "补全内容",
            width: "100%",
            content: (
                <div style={{height: 600}}>
                    <YakCodeEditor readOnly={true} originValue={Buffer.from(JSON.stringify(a), "utf8")} />
                </div>
            )
        })
    })

    // 全局监听登录状态
    const {userInfo, setStoreUserInfo} = useStore()

    /** yaklang引擎 连接成功后的配置事件 */
    const linkSuccess = () => {
        testYak()
    }

    const testYak = () => {
        getRemoteValue(RemoteGV.HttpSetting).then((setting) => {
            if (!setting) {
                ipcRenderer
                    .invoke("GetOnlineProfile", {})
                    .then((data: OnlineProfileProps) => {
                        ipcRenderer.sendSync("sync-edit-baseUrl", {baseUrl: data.BaseUrl}) // 同步
                        setRemoteValue(RemoteGV.HttpSetting, JSON.stringify({BaseUrl: data.BaseUrl}))
                        refreshLogin()
                    })
                    .catch((e) => {
                        failed(`获取失败:${e}`)
                    })
                    .finally(() => {
                        setOnlineProfileStatus(true)
                    })
            } else {
                const values = JSON.parse(setting)
                ipcRenderer
                    .invoke("SetOnlineProfile", {
                        ...values,
                        IsCompany: true
                    } as OnlineProfileProps)
                    .then(() => {
                        ipcRenderer.sendSync("sync-edit-baseUrl", {baseUrl: values.BaseUrl}) // 同步
                        setRemoteValue(RemoteGV.HttpSetting, JSON.stringify(values))
                        refreshLogin()
                    })
                    .catch((e: any) => failed("设置私有域失败:" + e))
                    .finally(() => {
                        setOnlineProfileStatus(true)
                    })
            }
        })
    }

    const refreshLogin = useMemoizedFn(() => {
        // 获取引擎中的token(区分企业版与社区版)
        const TokenSource = isCommunityEdition() ? RemoteGV.TokenOnline : RemoteGV.TokenOnlineEnterprise
        getRemoteValue(TokenSource)
            .then((resToken) => {
                if (!resToken) {
                    return
                }
                // 通过token获取用户信息
                NetWorkApi<API.UserInfoByToken, API.UserData>({
                    method: "post",
                    url: "auth/user",
                    data: {
                        token: resToken
                    }
                })
                    .then((res) => {
                        setRemoteValue(TokenSource, resToken)
                        const user = {
                            isLogin: true,
                            platform: res.from_platform,
                            githubName: res.from_platform === "github" ? res.name : null,
                            githubHeadImg: res.from_platform === "github" ? res.head_img : null,
                            wechatName: res.from_platform === "wechat" ? res.name : null,
                            wechatHeadImg: res.from_platform === "wechat" ? res.head_img : null,
                            qqName: res.from_platform === "qq" ? res.name : null,
                            qqHeadImg: res.from_platform === "qq" ? res.head_img : null,
                            companyName: res.from_platform === "company" ? res.name : null,
                            companyHeadImg: res.from_platform === "company" ? res.head_img : null,
                            role: res.role,
                            user_id: res.user_id,
                            token: resToken,
                            checkPlugin: res?.checkPlugin || false
                        }
                        ipcRenderer.sendSync("sync-update-user", user)
                        setStoreUserInfo(user)
                        refreshToken(user)
                    })
                    .catch((e) => setRemoteValue(TokenSource, ""))
            })
            .catch(() => setRemoteValue(TokenSource, ""))
    })

    /**
     * 拦截软件全局快捷键[(win:ctrl|mac:command) + 26字母]
     * 通过 InterceptKeyword 变量进行拦截控制
     */
    useEffect(() => {
        let originEvent = window.onkeydown
        window.onkeydown = (ev) => {
            let code = ev.code

            // 屏蔽当前事件
            if ((ev.metaKey || ev.ctrlKey) && InterceptKeyword.includes(code)) {
                return false
            }

            // @ts-ignore
            originEvent && originEvent(ev)
            return
        }
        return () => {
            window.onkeydown = originEvent
        }
    }, [])

    const {temporaryProjectId, delTemporaryProject} = useTemporaryProjectStore()
    const temporaryProjectIdRef = useRef<string>("")
    useEffect(() => {
        temporaryProjectIdRef.current = temporaryProjectId
    }, [temporaryProjectId])

    const {runNodeList, clearRunNodeList} = useRunNodeStore()
    const handleKillAllRunNode = async () => {
        let promises: (() => Promise<any>)[] = []
        Array.from(runNodeList).forEach(([key, pid]) => {
            promises.push(() => ipcRenderer.invoke("kill-run-node", {pid}))
        })
        try {
            await Promise.allSettled(promises.map((promiseFunc) => promiseFunc()))
            clearRunNodeList()
        } catch (error) {
            yakitFailed(error + "")
        }
    }

    // 退出时 确保渲染进程各类事项已经处理完毕
    const {dynamicStatus} = yakitDynamicStatus()
    useEffect(() => {
        ipcRenderer.on("close-windows-renderer", async (e, res: any) => {
            // 如果关闭按钮有其他的弹窗 则不显示 showMessageBox
            const showCloseMessageBox = !(Array.from(runNodeList).length || temporaryProjectIdRef.current)
            // 关闭前的所有接口调用都放到allSettled里面
            try {
                await Promise.allSettled([handleKillAllRunNode(), delTemporaryProject()
                    // , visitorsStatisticsFun("close")
                ])
            } catch (error) {
            }
            // 通知应用退出
            if (dynamicStatus.isDynamicStatus) {
                warn("远程控制关闭中...")
                await remoteOperation(false, dynamicStatus)
                ipcRenderer.invoke("app-exit", {showCloseMessageBox})
            } else {
                ipcRenderer.invoke("app-exit", {showCloseMessageBox})
            }
        })
        ipcRenderer.on("minimize-windows-renderer", async (e, res: any) => {
            // visitorsStatisticsFun()
        })
        return () => {
            ipcRenderer.removeAllListeners("close-windows-renderer")
            ipcRenderer.removeAllListeners("minimize-windows-renderer")
        }
    }, [dynamicStatus.isDynamicStatus])

    if (!agreed) {
        return (
            <>
                <div className={styles["yakit-mask-drag-wrapper"]}></div>
                <YakitModal
                    title='用户协议'
                    centered={true}
                    visible={true}
                    closable={false}
                    width='75%'
                    cancelText={"关闭 / Closed"}
                    onCancel={() => ipcRenderer.invoke("UIOperate", "close")}
                    okButtonProps={
                        {
                            // disabled: readingSeconds > 0,
                        }
                    }
                    onOk={() => {
                        ipcRenderer.invoke("set-local-cache", LocalGV.UserProtocolAgreed, true)
                        setReadingSeconds(3)
                        setAgreed(true)
                    }}
                    okText={
                        readingSeconds > 0
                            ? `我已认真阅读本协议(${readingSeconds}s)`
                            : "我已认真阅读本协议，认同协议内容"
                    }
                    bodyStyle={{padding: "16px 24px 24px 24px"}}
                >
                    <div className={styles["yakit-agr-modal-body"]}>
                        <div className={styles["body-title"]}>免责声明</div>
                        <div className={styles["body-content"]}>
                            1. 本工具仅面向 <span className={styles["sign-content"]}>合法授权</span>{" "}
                            的企业安全建设行为与个人学习行为，如您需要测试本工具的可用性，请自行搭建靶机环境。
                            <br />
                            2. 在使用本工具进行检测时，您应确保该行为符合当地的法律法规，并且已经取得了足够的授权。
                            <span className={styles["underline-content"]}>请勿对非授权目标进行扫描。</span>
                            <br />
                            3. 禁止对本软件实施逆向工程、反编译、试图破译源代码，植入后门传播恶意软件等行为。
                            <br />
                            <span className={styles["sign-bold-content"]}>
                                如果发现上述禁止行为，我们将保留追究您法律责任的权利。
                            </span>
                            <br />
                            如您在使用本工具的过程中存在任何非法行为，您需自行承担相应后果，我们将不承担任何法律及连带责任。
                            <br />
                            在安装并使用本工具前，请您{" "}
                            <span className={styles["sign-bold-content"]}>务必审慎阅读、充分理解各条款内容。</span>
                            <br />
                            限制、免责条款或者其他涉及您重大权益的条款可能会以{" "}
                            <span className={styles["sign-bold-content"]}>加粗</span>、
                            <span className={styles["underline-content"]}>加下划线</span>
                            等形式提示您重点注意。
                            <br />
                            除非您已充分阅读、完全理解并接受本协议所有条款，否则，请您不要安装并使用本工具。您的使用行为或者您以其他任何明示或者默示方式表示接受本协议的，即视为您已阅读并同意本协议的约束。
                        </div>
                    </div>
                </YakitModal>
            </>
        )
    }

    return (
        <UILayout linkSuccess={linkSuccess}>
            <Suspense fallback={<div>Loading Main</div>}>
                <Main onErrorConfirmed={() => {}} />
            </Suspense>
        </UILayout>
    )
}

export default NewApp
