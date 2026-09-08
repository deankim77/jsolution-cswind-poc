import type { Metadata } from "next";
import "./globals.css";
import "./project-lifecycle.css";
import "./wbs-ux-fix.css";
import "./wbs-direct-context.css";
import "./wbs-direct-operations.css";
import "./common-ai-chat-panel.css";
import "./common-kanban-view.css";
import "./common-gantt-view.css";
import "./common-work-views.css";
import "./work-view-switcher.css";
import "./project-wbs-workspace.css";
import "./my-work-workspace.css";
import "./wbs-planned-deliverable-drop.css";
import "./wbs-continuous-work.css";
import "./wbs-editor-toolbar-enhancer.css";
import "./wbs-editor-inline-shell.css";
import "./wbs-operational-toolbar-enhancer.css";
import "./wbs-deliverable-card.css";
import "./wbs-role-cascade.css";
import "./project-superuser-actions.css";
import "./global-ai-floating.css";
import "./ai-conversation-room-fix.css";
import "./ai-artifact-preview.css";
import "./ai-context-selection-block.css";
import "./workspace-typography.css";
import "./v2/v2-ui-foundation-enforcement.css";
import "./login/login.css";
import "./v2/work-view-v2.css";
import "./v2/v2-date-input.css";
import ProjectLifecycleEnhancer from "./project-lifecycle-enhancer";
import WbsDirectContext from "./wbs-direct-context";
import MyAiConversationSync from "./my-ai-conversation-sync";
import WbsPlannedDeliverableDrop from "./wbs-planned-deliverable-drop";
import WbsLiveProgressSync from "./wbs-live-progress-sync";
import WbsContinuousWorkEnhancer from "./wbs-continuous-work-enhancer";
import WbsEditorToolbarEnhancer from "./wbs-editor-toolbar-enhancer";
import WbsEditorInlineShell from "./wbs-editor-inline-shell";
import WbsOperationalToolbarEnhancer from "./wbs-operational-toolbar-enhancer";
import WbsRoleCascade from "./wbs-role-cascade";
import WbsOpenDefaultView from "./wbs-open-default-view";
import ProjectSuperuserActions from "./project-superuser-actions";
import GlobalAiPanelShift from "./global-ai-panel-shift";

export const metadata: Metadata = {
  title: "J SOLUTION AI PMS | MY AI HOME",
  description: "실제 프로젝트 데이터로 오늘의 업무와 위험을 알려주는 AI 중심 PMS",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>
    {children}
    <ProjectLifecycleEnhancer />
    <WbsDirectContext />
    <MyAiConversationSync />
    <WbsPlannedDeliverableDrop />
    <WbsLiveProgressSync />
    <WbsContinuousWorkEnhancer />
    <WbsEditorToolbarEnhancer />
    <WbsEditorInlineShell />
    <WbsOperationalToolbarEnhancer />
    <WbsRoleCascade />
    <WbsOpenDefaultView />
    <ProjectSuperuserActions />
    <GlobalAiPanelShift />
  </body></html>;
}
