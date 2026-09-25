(() => {
        const modal = document.querySelector('#lead-modal');
        const form = document.querySelector('#lead-form');
        const phoneInput = form ? form.querySelector('input[name="phone"]') : null;
        const telegramInput = form ? form.querySelector('input[name="telegram"]') : null;
        const status = form ? form.querySelector('.lead-status') : null;
        const submitButton = form ? form.querySelector('.lead-submit') : null;
        const closeButton = modal ? modal.querySelector('.lead-close') : null;
        const modalTriggers = document.querySelectorAll('[data-lead-intent], [data-lead-trigger]');
        const modalTitle = modal ? modal.querySelector('#lead-title') : null;
        const successPanel = modal ? modal.querySelector('#lead-success') : null;
        const modalIntro = modal ? modal.querySelector('#lead-intro') : null;
        const commentField = form ? form.querySelector('textarea[name="comment"]') : null;
        const leadIntents = {
          denis: { title: 'Консультация с Денисом', intro: 'Оставьте контакты и опишите задачу — свяжемся с вами, чтобы согласовать консультацию с Денисом Дворянкиным.', placeholder: 'Что вы хотите обсудить с Денисом?', submit: 'Запросить консультацию', source: 'Консультация с Денисом Дворянкиным' },
          demo: { title: 'Запросить демо', intro: 'Покажем возможности Executive AI и разберём ваш рабочий сценарий.', placeholder: 'Какую задачу вы хотите разобрать на демонстрации?', submit: 'Запросить демо', source: 'Демо — демонстрация продукта' },
          consultation: { title: 'Получить консультацию', intro: 'Расскажите о своей задаче — поможем выбрать подходящий формат Executive AI.', placeholder: 'Какую задачу вы хотите решить?', submit: 'Получить консультацию', source: 'Консультация' },
          implementation: { title: 'Обсудить внедрение', intro: 'Обсудим процессы вашей команды и варианты внедрения Executive AI.', placeholder: 'Какие процессы команды вы хотите улучшить?', submit: 'Обсудить внедрение', source: 'Внедрение' },
          cloud: { title: 'Подключить облачную версию', intro: 'Поможем выбрать тариф и начать работу с Executive AI в облаке.', placeholder: 'Для каких задач вам нужен Executive AI?', submit: 'Оставить заявку', source: 'Облачная версия' },
          personal: { title: 'Подключить Personal', intro: 'Для индивидуальной работы и экспертов. Тариф — 4 900 ₽ в месяц.', placeholder: 'В каких задачах вам нужна помощь?', submit: 'Подключить Personal', source: 'Тариф Personal' },
          pro: { title: 'Подключить Pro', intro: 'Для бизнеса и управления проектами. Тариф — 12 900 ₽ в месяц.', placeholder: 'Расскажите о команде и ваших проектах', submit: 'Подключить Pro', source: 'Тариф Pro' },
          custom: { title: 'Обсудить Custom', intro: 'Обсудим индивидуальную настройку, интеграции и требования к инфраструктуре.', placeholder: 'Какие задачи, интеграции и требования важно учесть?', submit: 'Обсудить проект', source: 'Custom' },
          access: { title: 'Получить доступ', intro: 'Оставьте контакты — поможем выбрать формат и подключиться к Executive AI.', placeholder: 'Как вы планируете использовать Executive AI?', submit: 'Получить доступ', source: 'Получить доступ' },
        };
        let selectedProduct = '';
        let isSubmitting = false;

        function setModalOpen(isOpen) {
          if (!modal) return;
          modal.classList.toggle('is-open', isOpen);
          modal.setAttribute('aria-hidden', String(!isOpen));
          document.body.classList.toggle('modal-open', isOpen);
          if (isOpen) {
            if (form) form.hidden = false;
            if (successPanel) successPanel.hidden = true;
            if (modalIntro) modalIntro.hidden = false;
            const firstInput = modal.querySelector('input[name="name"]');
            window.setTimeout(() => firstInput?.focus(), 120);
          }
        }

        function formatPhone(value) {
          let digits = value.replace(/\D/g, '');
          if (!digits) return '';
          if (digits[0] === '8') digits = `7${digits.slice(1)}`;
          if (digits[0] !== '7') digits = `7${digits}`;
          digits = digits.slice(0, 11);
          const local = digits.slice(1);
          let formatted = '+7';
          if (local.length > 0) formatted += ` (${local.slice(0, 3)}`;
          if (local.length >= 3) formatted += ')';
          if (local.length > 3) formatted += ` ${local.slice(3, 6)}`;
          if (local.length > 6) formatted += `-${local.slice(6, 8)}`;
          if (local.length > 8) formatted += `-${local.slice(8, 10)}`;
          return formatted;
        }

        function formatTelegram(value) {
          const trimmed = value.trim();
          if (!trimmed) return '';
          const username = trimmed.replace(/^@+/, '');
          return username ? `@${username}` : '@';
        }

        modalTriggers.forEach((trigger) => {
          trigger.addEventListener('click', (event) => {
            event.preventDefault();
            const intent = leadIntents[trigger.dataset.leadIntent] || leadIntents.implementation;
            selectedProduct = intent.source;
            if (modalTitle) modalTitle.textContent = intent.title;
            if (modalIntro) modalIntro.textContent = intent.intro;
            if (commentField) commentField.placeholder = intent.placeholder;
            if (submitButton) submitButton.textContent = intent.submit;
            if (status && !isSubmitting) status.textContent = '';
            setModalOpen(true);
          });
        });

        closeButton?.addEventListener('click', () => setModalOpen(false));
        modal?.addEventListener('click', (event) => {
          if (event.target === modal) setModalOpen(false);
        });
        window.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') setModalOpen(false);
        });

        phoneInput?.addEventListener('focus', () => {
          if (!phoneInput.value.trim()) phoneInput.value = '+7 ';
        });
        phoneInput?.addEventListener('input', () => {
          phoneInput.value = formatPhone(phoneInput.value);
        });
        phoneInput?.addEventListener('blur', () => {
          if (phoneInput.value.replace(/\D/g, '') === '7') phoneInput.value = '';
        });

        telegramInput?.addEventListener('input', () => {
          const formatted = formatTelegram(telegramInput.value);
          telegramInput.value = formatted;
          telegramInput.setSelectionRange(formatted.length, formatted.length);
        });
        telegramInput?.addEventListener('blur', () => {
          if (telegramInput.value === '@') telegramInput.value = '';
        });

        form?.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (isSubmitting || !form.reportValidity()) return;
          isSubmitting = true;

          const submit = form.querySelector('.lead-submit');
          const data = new FormData(form);
          const payload = {
            name: String(data.get('name') || '').trim(),
            phone: String(data.get('phone') || '').trim(),
            telegram: String(data.get('telegram') || '').trim(),
            comment: String(data.get('comment') || '').trim(),
            consent: Boolean(data.get('consent')),
            source: selectedProduct
              ? `Executive AI landing — ${selectedProduct}`
              : 'Executive AI landing',
          };

          if (submit) submit.disabled = true;
          if (status) status.textContent = 'Отправляем заявку...';

          try {
            const response = await fetch(form.action, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Request failed');
            form.reset();
            if (status) status.textContent = '';
            form.hidden = true;
            if (successPanel) successPanel.hidden = false;
            if (modalIntro) modalIntro.hidden = true;
            if (modalTitle) {
              modalTitle.textContent = 'Заявка отправлена';
              if (modal.classList.contains('is-open')) modalTitle.focus();
            }
          } catch (error) {
            if (status) status.textContent = 'Не удалось отправить. Попробуйте еще раз.';
          } finally {
            isSubmitting = false;
            if (submit) submit.disabled = false;
          }
        });

})();
