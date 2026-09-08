"use client";

import {Suspense,lazy,type ComponentType} from "react";
import "./project-cost-font-standard.css";
import "./schedule-header-unification.css";

const lazyNamed=(loader:()=>Promise<{default:ComponentType<any>}>)=>{
  const Component=lazy(loader);
  return (props:any)=><Suspense fallback={null}><Component {...props}/></Suspense>;
};

export type {V2Project} from "./project-workspaces";
export type {ReportAiRequest} from "./module-workspaces";
export type {AiDraftRequest,ContextItem} from "./connected-ai-workspaces";
export type {PortfolioProjectPreset} from "./gate-dashboards";
export type {IntegratedSearchResult} from "./integrated-global-search";
export type {ArtifactPreviewData} from "../artifact-preview-view";

export const ProjectCreateWorkspace=lazyNamed(()=>import("./project-create-workspace").then(module=>({default:module.ProjectCreateWorkspace})));
export const ProjectEditWorkspace=lazyNamed(()=>import("./project-workspaces").then(module=>({default:module.ProjectEditWorkspace})));
export const ProjectListWorkspace=lazyNamed(()=>import("./project-workspaces").then(module=>({default:module.ProjectListWorkspace})));
export const TemplateWorkspace=lazyNamed(()=>import("./project-workspaces").then(module=>({default:module.TemplateWorkspace})));

export const ReportsWorkspace=lazyNamed(()=>import("./module-workspaces").then(module=>({default:module.ReportsWorkspace})));
export const FilteredIssuesWorkspace=lazyNamed(()=>import("./issues-workspace").then(module=>({default:module.FilteredIssuesWorkspace})));
export const ConnectedAiPanel=lazyNamed(()=>import("./connected-ai-workspaces").then(module=>({default:module.ConnectedAiPanel})));
export const ContinuingAiHomeWorkspace=lazyNamed(()=>import("./connected-ai-workspaces").then(module=>({default:module.ContinuingAiHomeWorkspace})));
export const GatePortfolioDashboard=lazyNamed(()=>import("./gate-dashboards").then(module=>({default:module.GatePortfolioDashboard})));
export const GateProjectDashboard=lazyNamed(()=>import("./gate-dashboards").then(module=>({default:module.GateProjectDashboard})));
export const GateWorkPanel=lazyNamed(()=>import("./gate-work-panel").then(module=>({default:module.GateWorkPanel})));
export const NotificationCenterV2=lazyNamed(()=>import("./notification-center-v2").then(module=>({default:module.NotificationCenterV2})));
export const IntegratedGlobalSearch=lazyNamed(()=>import("./integrated-global-search").then(module=>({default:module.IntegratedGlobalSearch})));
export const PreviewDocumentsWorkspace=lazyNamed(()=>import("./document-preview-workspace").then(module=>({default:module.PreviewDocumentsWorkspace})));
export const SystemSettingsSuite=lazyNamed(()=>import("./system-settings-suite").then(module=>({default:module.SystemSettingsSuite})));
export const PartBomWorkspace=lazyNamed(()=>import("./part-library-workspace").then(module=>({default:module.PartLibraryWorkspace})));
export const BomCompareWorkspace=lazyNamed(()=>import("./bom-compare-workspace").then(module=>({default:module.BomCompareWorkspace})));
export const CostManagementWorkspace=lazyNamed(()=>import("./project-cost-workspace").then(module=>({default:module.ProjectCostWorkspace})));
export const ProjectMembersMasterDialog=lazyNamed(()=>import("./project-members-dialog").then(module=>({default:module.ProjectMembersMasterDialog})));
export const AdvancedGanttView=lazyNamed(()=>import("./advanced-gantt-view").then(module=>({default:module.AdvancedGanttView})));
export const AdvancedWbsEditor=lazyNamed(()=>import("./advanced-wbs-editor").then(module=>({default:module.AdvancedWbsEditor})));
export const ArtifactPreviewView=lazyNamed(()=>import("../artifact-preview-view").then(module=>({default:module.default})));
export const WorkPanel=lazyNamed(()=>import("./wbs-ai-work-panel").then(module=>({default:module.WorkPanel})));
export const ListView=lazyNamed(()=>import("./wbs-inline-views").then(module=>({default:module.ListView})));
export const TimelineView=lazyNamed(()=>import("./wbs-inline-views").then(module=>({default:module.TimelineView})));
export const KanbanView=lazyNamed(()=>import("./wbs-inline-views").then(module=>({default:module.KanbanView})));
export const CalendarView=lazyNamed(()=>import("./wbs-inline-views").then(module=>({default:module.CalendarView})));
