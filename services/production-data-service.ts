import {createCustomerDataService} from './customer-data-service';
import {createProductionDataRepository} from '../db/repositories/production-data-repository';
import type {CustomerDataScope} from '../db/repositories/customer-data-repository';
import {CustomerDataError} from '../lib/customer-data-contract';

export function createProductionDataService() {
  const repository=createProductionDataRepository();
  return {
    async list(scope:CustomerDataScope) {
      const data=await createCustomerDataService().list(scope);
      const structure=await repository.list(scope);
      const proposals=data.records.map(record=>{
        // Explicit template/filename mapping. This is not an AI document-content analysis.
        const match=record.fileName.toUpperCase().match(/TC800-(MAST|SLEWING|SLEW|JIB|COUNTERJIB|CJH)(?:-|\b)/);
        const stage=match?({MAST:'2',SLEWING:'3',SLEW:'3',JIB:'4',COUNTERJIB:'5',CJH:'5'} as Record<string,string>)[match[1]]:null;
        const sub=record.fileName.toUpperCase().match(/-SUB0([1-3])(?:-|\.)/);
        const expectedName=match?({MAST:"MAST",SLEWING:"SLEWING",SLEW:"SLEWING",JIB:"JIB",COUNTERJIB:"COUNTER JIB",CJH:"COUNTER JIB"} as Record<string,string>)[match[1]]:"";
        const mappedStage=stage&&structure.nodes.some(n=>n.code===stage&&n.name.toUpperCase().includes(expectedName))?stage:null;
        const candidate=mappedStage?(sub?`${mappedStage}.${sub[1]}`:mappedStage):'';
        const codes=candidate&&structure.nodes.some(n=>n.code===candidate&&n.kind==='summary')?[candidate]:[];
        return {recordId:record.id,codes,reason:codes.length?`파일명 ${record.fileName}의 TC800 ASSY 코드와 템플릿 연결`:'파일명으로 공정을 결정할 수 없습니다. 담당자가 선택하세요.'};
      });
      return {...data,...structure,proposals};
    },
    assign(scope:CustomerDataScope,input:{recordId?:unknown;codes?:unknown}) {
      if(typeof input.recordId!=='string'||!Array.isArray(input.codes)||input.codes.length>30||input.codes.some(code=>typeof code!=='string'))throw new CustomerDataError('할당 정보를 확인하세요.');
      return repository.assign(scope,input.recordId,[...new Set(input.codes)] as string[]);
    },
  };
}
