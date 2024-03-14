import { HybridScanControlAfterRequest } from "@/models/HybridScan"
import { GroupCount } from "@/pages/invoker/schema"

export interface YakPoCProps {
    pageId:string
}

export interface PluginGroupGridProps {
    hidden: boolean
    /**选择的插件组列表 */
    selectGroupList?: string[]
    setSelectGroupList?: (s: string[]) => void
}

export interface YakPoCExecuteContentProps {
    hidden: boolean
    setHidden: (b: boolean) => void
    /**选择的插件组列表 */
    selectGroupList: string[]
    setSelectGroupList: (s: string[]) => void
    defaultFormValue?:HybridScanControlAfterRequest
}

export interface PluginGroupGridItemProps {
    item: GroupCount
    selected:boolean
    onSelect: (g: GroupCount) => void
}