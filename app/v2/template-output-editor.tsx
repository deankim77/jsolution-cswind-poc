"use client";

import {Fragment} from "react";
import {Plus,X} from "lucide-react";

export type TemplateDeliverableOutput={
  masterCode?:string;
  name:string;
  type?:string;
  required?:boolean;
  documentKind?:"document"|"drawing";
};

type StandardOption={code:string;label:string};

export function TemplateOutputEditor({disabled,outputs,standards,onChange}:{disabled:boolean;outputs:TemplateDeliverableOutput[];standards:StandardOption[];onChange:(outputs:TemplateDeliverableOutput[])=>void}){
  const add=()=>onChange([...outputs,{masterCode:"",name:"",type:"",required:true,documentKind:"document"}]);
  const patch=(index:number,patch:Partial<TemplateDeliverableOutput>)=>onChange(outputs.map((item,cursor)=>cursor===index?{...item,...patch}:item));
  const remove=(index:number)=>onChange(outputs.filter((_,cursor)=>cursor!==index));
  const codeFor=(item:TemplateDeliverableOutput)=>item.masterCode||standards.find(option=>option.label===item.type||option.label.split(" > ").at(-1)===item.name)?.code||"";
  const rows=outputs.length?outputs:[{masterCode:"",name:"",type:"",required:true,documentKind:"document"} as TemplateDeliverableOutput];
  return <Fragment>
    <div className="wv2-template-output-column standard-column">
      {rows.map((item,index)=>{const selected=standards.find(option=>option.code===codeFor(item));return <div className="output-line" key={`standard-${index}-${item.masterCode||item.name}`}>
        <select className="output-standard" title={selected?.label||item.type||item.name||"표준 산출물 선택"} disabled={disabled} value={codeFor(item)} onChange={event=>{const next=standards.find(option=>option.code===event.target.value);if(index>=outputs.length){onChange([{masterCode:event.target.value,name:next?.label.split(" > ").at(-1)||"",type:next?.label||event.target.value,required:true,documentKind:"document"}]);return}patch(index,{masterCode:event.target.value,name:next?.label.split(" > ").at(-1)||"",type:next?.label||event.target.value})}}>
          <option value="">표준 산출물 선택</option>
          {standards.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}
        </select>
        {!disabled&&index===rows.length-1&&<button type="button" className="add-output" title="산출물 추가" onClick={add}><Plus size={15}/>추가</button>}
      </div>})}
    </div>
    <div className="wv2-template-output-column required-column">
      {rows.map((item,index)=><div className="output-line" key={`required-${index}-${item.masterCode||item.name}`}><select className="required-kind" title="필수/선택" disabled={disabled||index>=outputs.length} value={item.required===false?"optional":"required"} onChange={event=>patch(index,{required:event.target.value!=="optional"})}><option value="required">필수</option><option value="optional">선택</option></select></div>)}
    </div>
    <div className="wv2-template-output-column document-column">
      {rows.map((item,index)=><div className="output-line" key={`document-${index}-${item.masterCode||item.name}`}><select className="document-kind" title="문서/도면" disabled={disabled||index>=outputs.length} value={item.documentKind||"document"} onChange={event=>patch(index,{documentKind:event.target.value==="drawing"?"drawing":"document"})}><option value="document">문서</option><option value="drawing">도면</option></select>{index<outputs.length&&!disabled&&<button type="button" className="remove-output" aria-label="산출물 삭제" title="산출물 삭제" onClick={()=>remove(index)}><X size={15}/></button>}</div>)}
    </div>
  </Fragment>;
}
