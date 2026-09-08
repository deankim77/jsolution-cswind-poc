const DRAWING_TYPE_LABELS:Record<string,string>={
  PRODUCT_DRAWING:"제품도",
  PRODUCT:"제품도",
  LAYOUT:"제품도",
  PART_DRAWING:"부품도",
  PART:"부품도",
  ASSEMBLY_DRAWING:"조립도",
  ASSEMBLY:"조립도",
  PROCESS_DRAWING:"공정도",
  PROCESS:"공정도",
  PROCESS_FLOW:"공정도",
  DESIGN:"디자인",
  FABRIC_SPEC:"원단 사양",
  FABRIC:"원단 사양",
  OTHER:"기타",
  ELECTRICAL:"기타",
};

export const drawingTypeLabel=(value?:string)=>{
  const text=String(value||"").trim();
  if(!text)return "도면";
  return DRAWING_TYPE_LABELS[text.toUpperCase()]||text;
};
