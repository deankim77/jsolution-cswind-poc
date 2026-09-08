from pathlib import Path

# Replace the legacy common-panel input wrapper with the same input structure/class used by WBS AI chat.
p=Path('app/page.tsx')
s=p.read_text(encoding='utf-8')
old='''          <div className="panel-input">\n<input value={panelQuery} disabled={panelSending} onChange={e => setPanelQuery(e.target.value)} onKeyDown={e => {if(e.key === "Enter"&&!e.repeat){e.preventDefault();void askPanelAI();}}} placeholder="현재 문맥에서 AI에게 질문하세요"/>\n<button onClick={askPanelAI} disabled={panelSending||!panelQuery.trim()}>\n<Send size={17}/>\n</button>\n</div>'''
new='''          <div className="wbs-ai-chat-input shared-ai-chat-input">\n<input value={panelQuery} disabled={panelSending} onChange={e => setPanelQuery(e.target.value)} onKeyDown={e => {if(e.key === "Enter"&&!e.repeat){e.preventDefault();void askPanelAI();}}} placeholder="선택한 문맥을 기준으로 질문하세요"/>\n<button type="button" onClick={()=>void askPanelAI()} disabled={panelSending||!panelQuery.trim()}>\n<Send size={16}/>\n</button>\n</div>'''
assert old in s, 'legacy panel-input block not found'
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# Remove dead legacy panel-input/suggestion styles. WBS chat input CSS is now shared by both panels.
p=Path('app/shared-ai-chat.css')
s=p.read_text(encoding='utf-8')
start=s.find('.context-panel .ai-body .panel-input{')
assert start>=0, 'legacy panel-input css not found'
# everything from panel-input onward is legacy input/suggestion styling in this one-line stylesheet.
s=s[:start].rstrip()+"\n"
p.write_text(s,encoding='utf-8')
print('replaced legacy panel input with shared WBS chat input and removed dead CSS')
