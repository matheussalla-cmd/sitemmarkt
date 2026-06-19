// TheusMarkt — Sales Page JS

function toggleMenu() {
  document.getElementById('navMobile').classList.toggle('hidden');
}

function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = answer.classList.contains('open');
  document.querySelectorAll('.faq-a').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-q').forEach(q => q.classList.remove('open'));
  if (!isOpen) {
    answer.classList.add('open');
    btn.classList.add('open');
  }
}

window.addEventListener('scroll', () => {
  const nav = document.getElementById('nav');
  if (nav) nav.style.boxShadow = window.scrollY > 10 ? '0 4px 24px rgba(0,0,0,.3)' : 'none';
});

document.querySelectorAll('.nav-mobile a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('navMobile')?.classList.add('hidden');
  });
});
