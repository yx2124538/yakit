import React, {useEffect, useRef, useState} from "react"
import {
    NewPortScanExecuteProps,
    NewPortScanExecuteContentProps,
    NewPortScanExecuteFormProps,
    NewPortScanProps,
    PortScanExecuteExtraFormValue
} from "./newPortScanType"
import styles from "./newPortScan.module.scss"
import {
    ExpandAndRetract,
    ExpandAndRetractExcessiveState
} from "@/pages/plugins/operator/expandAndRetract/ExpandAndRetract"
import {useControllableValue, useCreation, useInViewport, useMemoizedFn} from "ahooks"
import {YakitTag} from "@/components/yakitUI/YakitTag/YakitTag"
import {StreamResult} from "@/hook/useHoldGRPCStream/useHoldGRPCStreamType"
import {PluginExecuteProgress} from "@/pages/plugins/operator/localPluginExecuteDetailHeard/LocalPluginExecuteDetailHeard"
import {YakitButton} from "@/components/yakitUI/YakitButton/YakitButton"
import {
    OutlineArrowscollapseIcon,
    OutlineArrowsexpandIcon,
    OutlineClipboardlistIcon,
    OutlineRefreshIcon,
    OutlineStoreIcon
} from "@/assets/icon/outline"
import classNames from "classnames"
import {Checkbox, Form} from "antd"
import cloneDeep from "lodash/cloneDeep"
import {ScanKind, ScanPortTemplate, defaultPorts} from "@/pages/portscan/PortScanPage"
import {YakitFormDraggerContent} from "@/components/yakitUI/YakitForm/YakitForm"
import {YakitCheckbox} from "@/components/yakitUI/YakitCheckbox/YakitCheckbox"
import {YakitInput} from "@/components/yakitUI/YakitInput/YakitInput"
import {isEnpriTrace} from "@/utils/envfile"
import {PluginExecuteResult} from "@/pages/plugins/operator/pluginExecuteResult/PluginExecuteResult"
import {randomString} from "@/utils/randomUtil"
import useHoldGRPCStream from "@/hook/useHoldGRPCStream/useHoldGRPCStream"
import {defaultSearch} from "@/pages/plugins/baseTemplate"
import {PluginLocalListDetails} from "@/pages/plugins/operator/PluginLocalListDetails/PluginLocalListDetails"
import {PluginFilterParams, PluginSearchParams} from "@/pages/plugins/baseTemplateType"
import {pluginTypeToName} from "@/pages/plugins/builtInData"
import {defaultLinkPluginConfig} from "@/pages/plugins/utils"
import {getLinkPluginConfig} from "@/pages/plugins/singlePluginExecution/SinglePluginExecution"
import {apiCancelPortScan, apiPortScan} from "./utils"
import {CheckboxValueType} from "antd/es/checkbox/Group"
import {PresetPorts} from "@/pages/portscan/schema"
import {yakitNotify} from "@/utils/notification"

const NewPortScanExtraParamsDrawer = React.lazy(() => import("./newPortScanExtraParamsDrawer"))

const {ipcRenderer} = window.require("electron")

/**端口扫描的默认查询的插件类型 */
const pluginTypeFilterList = ["mitm", "port-scan", "nuclei"].map((ele) => ({
    label: pluginTypeToName[ele]?.name || "-",
    value: ele,
    count: 0
}))

export const NewPortScan: React.FC<NewPortScanProps> = React.memo((props) => {
    // 隐藏插件列表
    const [hidden, setHidden] = useState<boolean>(false)
    const [search, setSearch] = useState<PluginSearchParams>(cloneDeep(defaultSearch))
    const [filters, setFilters] = useState<PluginFilterParams>({
        plugin_type: cloneDeep(pluginTypeFilterList)
    })
    const [selectList, setSelectList] = useState<string[]>([])
    const [selectNum, setSelectNum] = useState<number>(0)
    return (
        <PluginLocalListDetails
            hidden={hidden}
            selectList={selectList}
            setSelectList={setSelectList}
            search={search}
            setSearch={setSearch}
            selectNum={selectNum}
            setSelectNum={setSelectNum}
            showFilter={true}
            filters={filters}
            setFilters={setFilters}
            fixFilterList={[
                {
                    groupName: "插件类型",
                    groupKey: "plugin_type",
                    sort: 1,
                    data: pluginTypeFilterList
                }
            ]}
            pluginDetailsProps={{
                bodyClassName: styles["port-scan-body"]
            }}
        >
            <NewPortScanExecute
                selectNum={selectNum}
                selectList={selectList}
                setSelectList={setSelectList}
                hidden={hidden}
                setHidden={setHidden}
                pluginListSearchInfo={{search, filters}}
            />
        </PluginLocalListDetails>
    )
})

const NewPortScanExecute: React.FC<NewPortScanExecuteProps> = React.memo((props) => {
    const {selectList, setSelectList, pluginListSearchInfo, selectNum} = props

    const [hidden, setHidden] = useControllableValue<boolean>(props, {
        defaultValue: false,
        valuePropName: "hidden",
        trigger: "setHidden"
    })

    /**是否展开/收起 */
    const [isExpand, setIsExpand] = useState<boolean>(true)
    const [progressList, setProgressList] = useState<StreamResult.Progress[]>([])
    const [executeStatus, setExecuteStatus] = useState<ExpandAndRetractExcessiveState>("default")

    const pluginBatchExecuteContentRef = useRef(null)

    const onExpand = useMemoizedFn((e) => {
        e.stopPropagation()
        setIsExpand(!isExpand)
    })
    const onRemove = useMemoizedFn((e) => {
        e.stopPropagation()
        setSelectList([])
    })
    const isExecuting = useCreation(() => {
        if (executeStatus === "process") return true
        return false
    }, [executeStatus])
    const onStopExecute = useMemoizedFn(() => {
        // pluginBatchExecuteContentRef.current?.onStopExecute()
    })
    const onStartExecute = useMemoizedFn(() => {
        // pluginBatchExecuteContentRef.current?.onStartExecute()
    })

    return (
        <div className={styles["port-scan-execute-wrapper"]}>
            <ExpandAndRetract isExpand={isExpand} onExpand={onExpand} status={executeStatus}>
                <div className={styles["port-scan-executor-title"]}>
                    <span className={styles["port-scan-executor-title-text"]}>端口指纹扫描</span>
                    {selectNum > 0 && (
                        <YakitTag closable onClose={onRemove} color='info'>
                            {selectNum} 个插件
                        </YakitTag>
                    )}
                </div>
                <div className={styles["port-scan-executor-btn"]}>
                    {progressList.length === 1 && (
                        <PluginExecuteProgress percent={progressList[0].progress} name={progressList[0].id} />
                    )}
                    {isExecuting
                        ? !isExpand && (
                              <>
                                  <YakitButton danger onClick={onStopExecute}>
                                      停止
                                  </YakitButton>
                                  <div className={styles["divider-style"]}></div>
                              </>
                          )
                        : !isExpand && (
                              <>
                                  <YakitButton onClick={onStartExecute} disabled={selectNum === 0}>
                                      执行
                                  </YakitButton>
                                  <div className={styles["divider-style"]}></div>
                              </>
                          )}
                    {isEnpriTrace() && (
                        <>
                            <YakitButton icon={<OutlineClipboardlistIcon />} disabled={executeStatus === "default"}>
                                生成报告
                            </YakitButton>
                            <div className={styles["divider-style"]}></div>
                        </>
                    )}
                    <YakitButton
                        type='text2'
                        icon={hidden ? <OutlineArrowscollapseIcon /> : <OutlineArrowsexpandIcon />}
                        onClick={(e) => {
                            e.stopPropagation()
                            setHidden(!hidden)
                        }}
                    />
                </div>
            </ExpandAndRetract>
            <div className={styles["port-scan-executor-body"]}>
                <NewPortScanExecuteContent
                    isExpand={isExpand}
                    setIsExpand={setIsExpand}
                    isExecuting={isExecuting}
                    setExecuteStatus={setExecuteStatus}
                    selectNum={selectNum}
                    pluginListSearchInfo={pluginListSearchInfo}
                    selectList={selectList}
                />
            </div>
        </div>
    )
})

export const defPortScanExecuteExtraFormValue: PortScanExecuteExtraFormValue = {
    // -------start 表单放外面的字段
    Ports: defaultPorts,
    Mode: "fingerprint",
    Concurrent: 50,
    SkippedHostAliveScan: false,
    // -------end 表单放外面的字段

    // Targets: props.sendTarget ? JSON.parse(props.sendTarget || "[]").join(",") : "",
    Targets: "",
    Active: true,
    FingerprintMode: "all",
    Proto: ["tcp"],
    SaveClosedPorts: false,
    SaveToDB: true,
    Proxy: [],
    EnableBrute: false,
    ProbeTimeout: 7,
    ScriptNames: [],
    ProbeMax: 3,
    EnableCClassScan: false,
    HostAlivePorts: "22,80,443",
    EnableBasicCrawler: true,
    BasicCrawlerRequestMax: 5,
    SynConcurrent: 1000,
    HostAliveConcurrent: 20,
    LinkPluginConfig: cloneDeep(defaultLinkPluginConfig),
    /**@description 前端使用,扫描协议 */
    scanProtocol: "tcp"
}

const NewPortScanExecuteContent: React.FC<NewPortScanExecuteContentProps> = React.memo((props) => {
    const {isExpand, isExecuting, setExecuteStatus, setIsExpand, selectNum, pluginListSearchInfo, selectList} = props
    const [form] = Form.useForm()

    const [runtimeId, setRuntimeId] = useState<string>("")
    /**额外参数弹出框 */
    const [extraParamsVisible, setExtraParamsVisible] = useState<boolean>(false)
    const [extraParamsValue, setExtraParamsValue] = useState<PortScanExecuteExtraFormValue>(
        cloneDeep(defPortScanExecuteExtraFormValue)
    )

    const [stopLoading, setStopLoading] = useControllableValue<boolean>(props, {
        defaultValue: false,
        valuePropName: "stopLoading",
        trigger: "setStopLoading"
    })

    const tokenRef = useRef<string>(randomString(40))
    const newPortScanExecuteContentRef = useRef<HTMLDivElement>(null)
    const [inViewport = true] = useInViewport(newPortScanExecuteContentRef)

    const [streamInfo, portScanStreamEvent] = useHoldGRPCStream({
        taskName: "Port-Scan",
        apiKey: "PortScan",
        token: tokenRef.current,
        onEnd: () => {
            portScanStreamEvent.stop()
            setTimeout(() => {
                setExecuteStatus("finished")
                setStopLoading(false)
            }, 200)
        },
        setRuntimeId: (rId) => {
            setRuntimeId(rId)
        }
    })

    /**开始执行 */
    const onStartExecute = useMemoizedFn((value) => {
        const linkPluginConfig = getLinkPluginConfig(selectList, pluginListSearchInfo)
        let executeParams: PortScanExecuteExtraFormValue = {
            ...extraParamsValue,
            ...value,
            Proto: extraParamsValue.scanProtocol ? [extraParamsValue.scanProtocol] : [],
            LinkPluginConfig: linkPluginConfig || cloneDeep(defaultLinkPluginConfig)
        }
        portScanStreamEvent.reset()
        setRuntimeId("")
        apiPortScan(executeParams, tokenRef.current).then(() => {
            setExecuteStatus("process")
            setIsExpand(false)
            portScanStreamEvent.start()
        })
    })
    /**取消执行 */
    const onStopExecute = useMemoizedFn((e) => {
        e.stopPropagation()
        apiCancelPortScan(tokenRef.current).then(() => {
            portScanStreamEvent.stop()
            setExecuteStatus("finished")
        })
    })
    const openExtraPropsDrawer = useMemoizedFn(() => {
        setExtraParamsValue({
            ...extraParamsValue,
            SkippedHostAliveScan: form.getFieldValue("SkippedHostAliveScan")
        })
        setExtraParamsVisible(true)
    })
    /**保存额外参数 */
    const onSaveExtraParams = useMemoizedFn((v: PortScanExecuteExtraFormValue) => {
        setExtraParamsValue({...v} as PortScanExecuteExtraFormValue)
        setExtraParamsVisible(false)
        form.setFieldsValue({
            SkippedHostAliveScan: v.SkippedHostAliveScan
        })
    })
    const isShowResult = useCreation(() => {
        return isExecuting || runtimeId
    }, [isExecuting, runtimeId])
    return (
        <>
            <div
                className={classNames(styles["port-scan-form-wrapper"], {
                    [styles["port-scan-form-wrapper-hidden"]]: !isExpand
                })}
                ref={newPortScanExecuteContentRef}
            >
                <Form
                    form={form}
                    onFinish={onStartExecute}
                    labelCol={{span: 6}}
                    wrapperCol={{span: 12}} //这样设置是为了让输入框居中
                    validateMessages={{
                        /* eslint-disable no-template-curly-in-string */
                        required: "${label} 是必填字段"
                    }}
                    labelWrap={true}
                >
                    <NewPortScanExecuteForm
                        inViewport={inViewport}
                        form={form}
                        disabled={isExecuting}
                        extraParamsValue={extraParamsValue}
                    />
                    <Form.Item colon={false} label={" "} style={{marginBottom: 0}}>
                        <div className={styles["plugin-execute-form-operate"]}>
                            {isExecuting ? (
                                <YakitButton danger onClick={onStopExecute} size='large'>
                                    停止
                                </YakitButton>
                            ) : (
                                <YakitButton
                                    className={styles["plugin-execute-form-operate-start"]}
                                    htmlType='submit'
                                    size='large'
                                    disabled={selectNum === 0}
                                >
                                    开始执行
                                </YakitButton>
                            )}
                            <YakitButton type='text' onClick={openExtraPropsDrawer} disabled={isExecuting} size='large'>
                                额外参数
                            </YakitButton>
                        </div>
                    </Form.Item>
                </Form>
            </div>
            {isShowResult && (
                <PluginExecuteResult
                    streamInfo={streamInfo}
                    runtimeId={runtimeId}
                    loading={isExecuting}
                    pluginType={"yak"} // 算yak类型的插件，可以传空字符串
                    defaultActiveKey={""}
                />
            )}
            <React.Suspense fallback={<div>loading...</div>}>
                <NewPortScanExtraParamsDrawer
                    extraParamsValue={extraParamsValue}
                    visible={extraParamsVisible}
                    setVisible={setExtraParamsVisible}
                    onSave={onSaveExtraParams}
                />
            </React.Suspense>
        </>
    )
})

const NewPortScanExecuteForm: React.FC<NewPortScanExecuteFormProps> = React.memo((props) => {
    const {inViewport, disabled, form, extraParamsValue} = props
    const [templatePort, setTemplatePort] = useState<string>()

    const ports = Form.useWatch("Ports", form)

    useEffect(() => {
        if (inViewport) onGetTemplatePort()
    }, [inViewport])
    const onGetTemplatePort = useMemoizedFn(() => {
        ipcRenderer
            .invoke("fetch-local-cache", ScanPortTemplate)
            .then((value: string) => {
                if (value) {
                    setTemplatePort(value || "")
                }
            })
            .catch(() => {})
    })
    const onSetTemplatePort = useMemoizedFn(() => {
        const ports = form.getFieldValue("Ports")
        if (!ports) {
            yakitNotify("error", "请输入端口后再保存")
            return
        }
        ipcRenderer.invoke("set-local-cache", ScanPortTemplate, ports).then(() => {
            yakitNotify("success", "保存成功")
            setTemplatePort(ports)
        })
    })
    /**选择预设端口设置Ports值 */
    const onCheckPresetPort = useMemoizedFn((checkedValue: CheckboxValueType[]) => {
        let res: string = (checkedValue || [])
            .map((i) => {
                if (i === "template") return templatePort
                return PresetPorts[i as string] || ""
            })
            .join(",")
        if (!!res) {
            form.setFieldsValue({Ports: res})
        }
    })
    const onResetPort = useMemoizedFn(() => {
        form.setFieldsValue({Ports: defaultPorts, presetPort: []})
    })
    return (
        <>
            <YakitFormDraggerContent
                formItemProps={{
                    name: "Targets",
                    label: "扫描目标",
                    rules: [{required: true}]
                }}
                accept='.txt,.xlsx,.xls,.csv'
                textareaProps={{
                    placeholder: "域名/主机/IP/IP段均可，逗号分隔或按行分割",
                    rows: 3
                }}
                help='可将TXT、Excel文件拖入框内或'
                disabled={disabled}
            />
            <Form.Item label='预设端口' name='presetPort' valuePropName='checked'>
                <Checkbox.Group
                    className={styles["preset-port-group-wrapper"]}
                    onChange={onCheckPresetPort}
                    disabled={disabled}
                >
                    <YakitCheckbox value={"top100"}>常见100端口</YakitCheckbox>
                    <YakitCheckbox value={"topweb"}>常见 Web 端口</YakitCheckbox>
                    <YakitCheckbox value={"top1000+"}>常见一两千</YakitCheckbox>
                    <YakitCheckbox value={"topdb"}>常见数据库与 MQ</YakitCheckbox>
                    <YakitCheckbox value={"topudp"}>常见 UDP 端口</YakitCheckbox>
                    {templatePort && <YakitCheckbox value={"template"}>模板</YakitCheckbox>}
                </Checkbox.Group>
            </Form.Item>
            <Form.Item
                label='扫描端口'
                name='Ports'
                extra={
                    <div className={styles["ports-form-extra"]}>
                        <YakitButton
                            type='text'
                            icon={<OutlineStoreIcon />}
                            style={{paddingLeft: 0}}
                            onClick={onSetTemplatePort}
                        >
                            存为模块
                        </YakitButton>
                        <div className={styles["divider-style"]}></div>
                        <YakitButton type='text' icon={<OutlineRefreshIcon />} onClick={onResetPort}>
                            默认配置
                        </YakitButton>
                    </div>
                }
                initialValue={defaultPorts}
            >
                <YakitInput.TextArea rows={3} disabled={disabled} />
            </Form.Item>
            <Form.Item label={" "} colon={false}>
                <div className={styles["form-extra"]}>
                    <Form.Item name='SkippedHostAliveScan' valuePropName='checked' noStyle>
                        <YakitCheckbox disabled={disabled}>跳过主机存活检测</YakitCheckbox>
                    </Form.Item>
                    <YakitTag>扫描模式：{ScanKind[extraParamsValue.Mode]}</YakitTag>
                    <YakitTag>指纹扫描并发：{extraParamsValue.Concurrent}</YakitTag>
                </div>
            </Form.Item>
        </>
    )
})
