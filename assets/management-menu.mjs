export function setupManagementMenu(tools) {
  if(!tools)return;
  const summary=tools.querySelector('summary'),menu=tools.querySelector('.management-tool-menu');
  if(!summary||!menu)return;
  function place(){
    if(!tools.open)return;
    const rect=summary.getBoundingClientRect(),height=window.innerHeight;
    if(rect.bottom<8||rect.top>height-8){tools.open=false;return;}
    const below=height-rect.bottom-16,above=rect.top-16;
    const up=below<Math.min(menu.scrollHeight,280)&&above>below;
    tools.toggleAttribute('data-open-up',up);
    menu.style.maxHeight=Math.min(560,Math.max(44,up?above:below))+'px';
  }
  tools.addEventListener('toggle',place);
  window.addEventListener('resize',place);
  window.addEventListener('scroll',place,true);
  document.addEventListener('click',event=>{if(tools.open&&!tools.contains(event.target))tools.open=false;});
  tools.addEventListener('keydown',event=>{if(event.key==='Escape'&&tools.open){tools.open=false;summary.focus();event.preventDefault();}});
  menu.addEventListener('click',event=>{if(event.target.closest('button'))tools.open=false;});
}
