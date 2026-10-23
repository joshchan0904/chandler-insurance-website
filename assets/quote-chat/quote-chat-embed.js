(function(){
  document.addEventListener('DOMContentLoaded', function() {
    var embed = document.getElementById('qchat-embed');
    if (!embed) return;

    var html = '<div class="qchat-head"><h2 class="qchat-title">Quick quote chat</h2><p class="qchat-sub">About 2 minutes — skip anything you don\'t know.</p></div>' +
      '<div id="prog"></div><div id="chat" tabindex="-1"></div><div id="sum"></div><div id="classic" class="np"></div>' +
      '<p class="qchat-toggle-wrap"><button type="button" class="qchat-toggle" aria-expanded="false" aria-controls="qchat-classic">Prefer the classic form?</button></p>';

    embed.innerHTML = html;

    document.documentElement.classList.add('qchat-on');

    var toggleBtn = embed.querySelector('.qchat-toggle');
    var classicShown = false;
    var urlParams = new URLSearchParams(window.location.search);
    var queryClassic = urlParams.get('form') === 'classic';

    if (queryClassic) {
      classicShown = true;
      document.documentElement.classList.add('qchat-show-classic');
      toggleBtn.setAttribute('aria-expanded', 'true');
      toggleBtn.textContent = 'Hide classic form';
    }

    function updateToggle() {
      if (classicShown) {
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.textContent = 'Hide classic form';
      } else {
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.textContent = 'Prefer the classic form?';
      }
    }

    toggleBtn.addEventListener('click', function() {
      classicShown = !classicShown;
      if (classicShown) {
        document.documentElement.classList.add('qchat-show-classic');
      } else {
        document.documentElement.classList.remove('qchat-show-classic');
      }
      updateToggle();

      if (classicShown) {
        var classicEl = document.getElementById('qchat-classic') || document.querySelector('[data-classic]');
      }
    });

    // Ensure first data-classic has id
    var firstClassic = document.querySelector('[data-classic]');
    if (firstClassic && !firstClassic.id) {
      firstClassic.id = 'qchat-classic';
    }

    // Append the chat JS
    var script = document.createElement('script');
    script.src = '/assets/quote-chat/quote-chat.js?v=40';
    document.body.appendChild(script);
  });
})();