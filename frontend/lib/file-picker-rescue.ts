// The inline script that makes "Choose file" work before React is listening.
//
// THE BUG IT FIXES (reported by a real user, 2026-08-06): every dropzone opens
// its file picker from a React onClick, and the input itself is display:none.
// Between the page painting and React hydrating, the button looks completely
// ready and does absolutely nothing — no error, so nothing reached the error
// beacon either. On a mid-range phone over mobile data that window is seconds
// long, and it lands exactly when an impatient user taps.
//
// This runs as a plain inline script in <head>, so it is listening from the
// first frame. It hands the click to the nearest file input, and steps aside
// the moment React takes over (the <FilePickerRescue/> component sets the flag).
//
// Kept as a string so it can be audited here rather than buried in JSX.
//
// ⚠ NO `//` COMMENTS INSIDE THE SCRIPT BODY. It ships as one inline <script>,
// and an earlier version collapsed to a single line — the first line comment
// then commented out the entire rest of the script, silently. Explanations live
// out here; the body stays comment-free.
export const FILE_PICKER_RESCUE = `
(function(){
  try{
    var MAX_HOPS = 6;
    function findInput(el){
      var node = el;
      for (var i = 0; node && i < MAX_HOPS; i++, node = node.parentElement){
        var found = node.querySelector && node.querySelector('input[type=file]');
        if (found && !found.disabled) return found;
      }
      return null;
    }
    document.addEventListener('click', function(e){
      if (window.__ddHydrated) return;
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('a,label,input,select,textarea,[data-no-pick]')) return;
      var input = findInput(t);
      if (!input) return;
      e.preventDefault();
      e.stopPropagation();
      input.click();
      try{ window.__ddEarlyPick = (window.__ddEarlyPick || 0) + 1; }catch(_){}
    }, true);
  }catch(_){}
})();
`;
