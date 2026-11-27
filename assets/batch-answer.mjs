const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Keep actual option identities separate from letters inside their contents.
export function choiceAnswerMarkup(options,choiceKey){
 const selected=new Set(choiceKey||[]);
 const answers=options.filter(option=>selected.has(option.label));
 if(!answers.length)return '';
 return '<div class="batch-choice-answers" role="list">'+answers.map(({label,text})=>`<div class="batch-choice-answer" role="listitem"><span class="batch-choice-label">${escape(label)}.</span> <span class="batch-choice-content">${escape(text)}</span></div>`).join('')+'</div>';
}
