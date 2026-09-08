"use client";

import NewWorkViewApp from "./v2/NewWorkViewApp";
import {AdminProjectDeleteControl} from "./v2/admin-project-delete-control";
import {ProductDataBridge} from "./v2/product-data-bridge";
import {PinnedTabsSettings} from "./v2/pinned-tabs-settings";
import "./v2/document-preview-fix.css";
import "./v2/right-panel-defaults.css";

export default function Home(){
  return <><NewWorkViewApp/><AdminProjectDeleteControl/><ProductDataBridge/><PinnedTabsSettings/></>;
}
