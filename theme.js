// 즉시 실행: 저장된 테마를 <html>에 적용 (FOUC 방지)
(function () {
  var t = localStorage.getItem('folio-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
}());

document.addEventListener('DOMContentLoaded', function () {
  var btn = document.getElementById('themeToggle');
  if (!btn) return;

  btn.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';

    // 부드러운 전환을 위해 transition 클래스 일시 추가
    document.documentElement.classList.add('theme-transitioning');
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('folio-theme', next);
    document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    setTimeout(function () {
      document.documentElement.classList.remove('theme-transitioning');
    }, 300);
  });
});
