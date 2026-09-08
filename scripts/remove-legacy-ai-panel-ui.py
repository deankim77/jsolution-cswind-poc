from pathlib import Path

# one-time cleanup trigger v3
p=Path('app/page.tsx')
s=p.read_text(encoding='utf-8')
old='''          {messagesLoading?<div className="ai-message"><span><History size={16}/></span><p>이전 대화를 불러오는 중입니다.</p></div>:panelMessages.length>0?<div className="conversation-history">{panelMessages.map(message=><div className={`ai-message ${message.role==="user"?"user-message":"assistant-message"}`} key={message.id}><span>{message.role==="user"?"나":<Bot size={16}/>}</span><p>{message.content}</p></div>)}{panelSending&&<div className="ai-message assistant-message"><span><Bot size={16}/></span><p>답변을 생성하고 있습니다…</p></div>}</div>:panelSending?<div className="ai-message assistant-message"><span><Bot size={16}/></span><p>답변을 생성하고 있습니다…</p></div>:<div className="ai-message">
<span>
<Bot size={16}/>
</span>
<p>무엇을 함께 확인할까요? 현재 상태 요약, 지연 원인 분석, 다음 행동 제안이 가능합니다.</p>
</div>}
          <div className="panel-suggestions">
<button onClick={() => setPanelQuery("핵심 위험과 다음 조치를 알려줘")}>핵심 위험과 다음 조치</button>
<button onClick={() => setPanelQuery("관련 업무를 우선순위로 정리해줘")}>관련 업무 우선순위</button>
</div>
'''
new='''          {messagesLoading?<div className="ai-message"><span><History size={16}/></span><p>이전 대화를 불러오는 중입니다.</p></div>:panelMessages.length>0?<div className="conversation-history">{panelMessages.map(message=><div className={`ai-message ${message.role==="user"?"user-message":"assistant-message"}`} key={message.id}><span>{message.role==="user"?"나":<Bot size={16}/>}</span><p>{message.content}</p></div>)}{panelSending&&<div className="ai-message assistant-message"><span><Bot size={16}/></span><p>답변을 생성하고 있습니다…</p></div>}</div>:panelSending?<div className="ai-message assistant-message"><span><Bot size={16}/></span><p>답변을 생성하고 있습니다…</p></div>:null}
'''
assert old in s, 'legacy AI panel block not found'
s=s.replace(old,new,1)
old2='<AiContextSelectionBlock items={items} onRemove={removeCurrentAiContextItem} onClear={clearCurrentAiContext}/>'
new2='<AiContextSelectionBlock items={items} onRemove={item=>removeCurrentAiContextItem(item as AiContextItem)} onClear={clearCurrentAiContext}/>'
assert old2 in s, 'AI context remove callback marker not found'
s=s.replace(old2,new2,1)
p.write_text(s,encoding='utf-8')
print('removed legacy AI panel intro/suggestions and fixed context callback typing')
