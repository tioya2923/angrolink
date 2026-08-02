import { useEffect } from 'react';

function mensagemDeValidacao(elemento: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const { validity } = elemento;

  if (validity.valueMissing) return 'Preencha este campo.';
  if (validity.typeMismatch && elemento instanceof HTMLInputElement && elemento.type === 'email') {
    return 'Introduza um endereço de e-mail válido.';
  }
  if (validity.typeMismatch) return 'Introduza um valor válido.';
  if (validity.patternMismatch) return 'O formato deste campo não é válido.';
  if (validity.tooShort && (elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement)) {
    return `Introduza pelo menos ${elemento.minLength} caracteres.`;
  }
  if (validity.tooLong && (elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement)) {
    return `Introduza no máximo ${elemento.maxLength} caracteres.`;
  }
  if (validity.rangeUnderflow && elemento instanceof HTMLInputElement) {
    return `Introduza um valor igual ou superior a ${elemento.min}.`;
  }
  if (validity.rangeOverflow && elemento instanceof HTMLInputElement) {
    return `Introduza um valor igual ou inferior a ${elemento.max}.`;
  }
  if (validity.badInput) return 'Introduza um valor válido.';

  return 'Verifique este campo.';
}

/** Traduz as mensagens nativas de validação para toda a aplicação. */
export default function MensagensValidacaoNativas() {
  useEffect(() => {
    type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const camposConfigurados = new WeakSet<Campo>();

    const aoInvalidar = (event: Event) => {
      const elemento = event.target;
      if (
        elemento instanceof HTMLInputElement ||
        elemento instanceof HTMLSelectElement ||
        elemento instanceof HTMLTextAreaElement
      ) {
        elemento.setCustomValidity(mensagemDeValidacao(elemento));
      }
    };

    const aoEditar = (event: Event) => {
      const elemento = event.target;
      if (
        elemento instanceof HTMLInputElement ||
        elemento instanceof HTMLSelectElement ||
        elemento instanceof HTMLTextAreaElement
      ) {
        elemento.setCustomValidity('');
        atualizarDica(elemento);
      }
    };

    const atualizarDica = (campo: Campo) => {
      const vazio = campo.required && !campo.value.trim();

      if (vazio) {
        if (!campo.dataset.tituloOriginal && campo.title) {
          campo.dataset.tituloOriginal = campo.title;
        }
        campo.title = 'Preencha este campo.';
        return;
      }

      if (campo.dataset.tituloOriginal) {
        campo.title = campo.dataset.tituloOriginal;
        delete campo.dataset.tituloOriginal;
      } else if (campo.title === 'Preencha este campo.') {
        campo.removeAttribute('title');
      }
    };

    const configurarCampo = (campo: Campo) => {
      if (camposConfigurados.has(campo)) return;
      camposConfigurados.add(campo);

      // O listener no próprio campo é executado no alvo da validação e assegura
      // que o browser recebe a tradução antes de abrir o balão de erro.
      campo.addEventListener('invalid', aoInvalidar);
      campo.addEventListener('input', aoEditar);
      campo.addEventListener('change', aoEditar);
      atualizarDica(campo);
    };

    const configurarCampos = (raiz: ParentNode = document) => {
      raiz.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input, select, textarea',
      ).forEach(configurarCampo);
    };

    const configurarFormularios = (raiz: ParentNode = document) => {
      raiz.querySelectorAll('form').forEach(formulario => {
        // Impede o browser de apresentar a tradução do sistema antes de a
        // aplicação poder aplicar a mensagem portuguesa abaixo.
        formulario.noValidate = true;
      });
    };

    const aoSubmeter = (event: Event) => {
      const formulario = event.target;
      if (!(formulario instanceof HTMLFormElement)) return;

      const primeiroInvalido = Array.from(formulario.elements).find(elemento =>
        elemento instanceof HTMLInputElement ||
        elemento instanceof HTMLSelectElement ||
        elemento instanceof HTMLTextAreaElement
          ? !elemento.checkValidity()
          : false,
      ) as Campo | undefined;

      if (!primeiroInvalido) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      primeiroInvalido.setCustomValidity(mensagemDeValidacao(primeiroInvalido));
      primeiroInvalido.reportValidity();
      primeiroInvalido.focus();
    };

    configurarCampos();
    configurarFormularios();

    const observador = new MutationObserver(registos => {
      registos.forEach(registo => {
        registo.addedNodes.forEach(no => {
          if (!(no instanceof Element)) return;
          if (no.matches('input, select, textarea')) configurarCampo(no as Campo);
          configurarCampos(no);
          if (no.matches('form')) (no as HTMLFormElement).noValidate = true;
          configurarFormularios(no);
        });
      });
    });

    observador.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('submit', aoSubmeter, true);

    return () => {
      observador.disconnect();
      document.removeEventListener('submit', aoSubmeter, true);
    };
  }, []);

  return null;
}
