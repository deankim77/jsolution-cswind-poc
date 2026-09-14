import {createDocumentLibraryRepository} from '../db/repositories/document-library-repository';
export function createDocumentLibraryService(repository=createDocumentLibraryRepository()){
 return {project:(companyId:string,projectId:string,taskId:string|null)=>repository.project(companyId,projectId,taskId),list:(companyId:string,params:URLSearchParams)=>repository.list(companyId,params)};
}
