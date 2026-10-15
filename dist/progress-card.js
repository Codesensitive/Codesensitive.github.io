export function stagePercent(message){
  const matches=[...String(message).matchAll(/(?:^|\s)(\d+(?:\.\d+)?)\s*%/g)];
  return matches.length?Math.max(0,Math.min(100,Number(matches.at(-1)[1]))):null;
}
export class ProgressCard{
  constructor(document){this.card=document.getElementById('operation-card');this.title=document.getElementById('operation-title');this.detail=document.getElementById('operation-detail');this.bar=document.getElementById('operation-progress');this.fill=document.getElementById('operation-fill');this.label=document.getElementById('operation-percent');this.cancel=document.getElementById('cancel-operation');}
  start(title,detail,cancellable){
    const wasHidden=this.card.hidden;this.card.hidden=false;this.title.textContent=title;this.cancel.hidden=!cancellable;this.cancel.disabled=false;this.update(detail);
    if(wasHidden)this.card.scrollIntoView?.({block:'start',behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  update(message){
    this.detail.textContent=message;const percent=stagePercent(message),determinate=percent!==null;
    this.bar.classList.toggle('indeterminate',!determinate);
    this.label.textContent=determinate?`${Math.round(percent)}% · current stage`:'In progress';
    if(determinate){this.bar.setAttribute('aria-valuenow',String(percent));this.fill.style.width=`${percent}%`;}
    else{this.bar.removeAttribute('aria-valuenow');this.fill.style.removeProperty('width');}
    this.bar.setAttribute('aria-valuetext',determinate?`${Math.round(percent)} percent of the current stage`:'Processing; progress is not yet measurable');
  }
  end(){this.card.hidden=true;}
}
