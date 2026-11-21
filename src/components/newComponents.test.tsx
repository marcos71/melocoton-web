import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { DisabledReason } from './DisabledReason'
import { Notice } from './Notice'
import { PhoneLink } from './PhoneLink'
import { RadioCardGroup } from './RadioCardGroup'
import { SelectField } from './SelectField'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('DI47_showsTheStatusAsText', () => {
    render(
      <>
        <StatusBadge>Activo</StatusBadge>
        <StatusBadge variant="filled">Inactivo</StatusBadge>
      </>,
    )

    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })
})

describe('PhoneLink', () => {
  it('DI51_isATelLinkWithTheNumberInTextAndAnAccessibleName', () => {
    render(<PhoneLink name="Lucía Pérez" phone="11 5555-0101" />)

    const link = screen.getByRole('link', { name: 'Llamar a Lucía Pérez, 11 5555-0101' })
    expect(link).toHaveAttribute('href', 'tel:1155550101')
    expect(link).toHaveTextContent('11 5555-0101')
  })

  it('DI51_isPlainTextWhenThePhoneHasNoDigits', () => {
    render(<PhoneLink name="Lucía Pérez" phone="sin teléfono" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('sin teléfono')).toBeInTheDocument()
  })
})

describe('Notice', () => {
  it.each([
    ['success', 'Listo:', 'status'],
    ['info', 'Info:', 'status'],
    ['warning', 'Atención:', 'status'],
    ['error', 'Error:', 'alert'],
  ] as const)('DI47_%sStartsWithItsWordAndHasTheRightRole', (kind, word, role) => {
    render(<Notice kind={kind} text="Texto del aviso." />)

    const notice = screen.getByRole(role)
    expect(notice).toHaveTextContent(`${word} Texto del aviso.`)
    expect(notice.querySelector('strong')).toHaveTextContent(word)
  })

  it('DI43_showsTheListTheFooterAndTheLink', () => {
    render(
      <MemoryRouter>
        <Notice
          kind="warning"
          text="Tiene clases excedidas."
          items={['Jue 3 de dic: 9 alumnos para 8 lugares']}
          footer="Se guardaron igual."
          link={{ to: '/slots', label: 'Ver en Turnos' }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('listitem')).toHaveTextContent('Jue 3 de dic: 9 alumnos para 8 lugares')
    expect(screen.getByText('Se guardaron igual.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver en Turnos' })).toHaveAttribute('href', '/slots')
  })

  it('DI47_theCloseButtonOnlyExistsWithOnCloseAndCallsIt', async () => {
    const onClose = vi.fn()
    const { rerender } = render(<Notice kind="success" text="Hecho." />)
    expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument()

    rerender(<Notice kind="success" text="Hecho." onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('DisabledReason', () => {
  it('RNF21_isAriaDisabledKeepsTheFocusAndLinksTheReason', async () => {
    render(
      <DisabledReason label="Asignar turno fijo" reason="Todavía no hay turnos.">
        <a href="/slots">Ir a Turnos</a>
      </DisabledReason>,
    )

    const button = screen.getByRole('button', { name: 'Asignar turno fijo' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    expect(button).toHaveAccessibleDescription('Todavía no hay turnos.')
    expect(screen.getByRole('link', { name: 'Ir a Turnos' })).toBeInTheDocument()
    await userEvent.tab()
    expect(button).toHaveFocus()
  })
})

describe('SelectField', () => {
  it('RNF21_hasAVisibleLabelAndAnnouncesTheHintAndTheError', () => {
    render(
      <SelectField label="Modalidad" hint="Elegí una." error="Falta elegir.">
        <option value="">Todas</option>
      </SelectField>,
    )

    const select = screen.getByLabelText('Modalidad')
    expect(select).toHaveAccessibleDescription('Elegí una. Error: Falta elegir.')
    expect(select).toBeInvalid()
  })

  it('RNF21_keepsAnExtraDescribedByOfTheCaller', () => {
    render(
      <>
        <p id="extra">Extra</p>
        <SelectField label="Turno" aria-describedby="extra">
          <option value="">Todos</option>
        </SelectField>
      </>,
    )

    expect(screen.getByLabelText('Turno')).toHaveAccessibleDescription('Extra')
  })
})

describe('RadioCardGroup', () => {
  const options = [
    { value: 'a', label: 'Lunes 10:00 a 12:00', description: 'Cupo: 8' },
    { value: 'b', label: 'Martes 18:00 a 20:00', description: 'Cupo: 8', unavailableReason: 'Es su turno actual.' },
  ]

  it('RNF21_isAFieldsetWithALegendAndOneRadioPerOption', () => {
    render(<RadioCardGroup legend="Elegí el turno" options={options} value={null} onChange={() => {}} />)

    const group = screen.getByRole('group', { name: 'Elegí el turno' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByRole('radio', { name: /Lunes 10:00/ })).toHaveAccessibleDescription('Cupo: 8')
    expect(screen.getByRole('radio', { name: /Lunes 10:00/ })).not.toBeChecked()
  })

  it('RNF21_choosingAnOptionCallsOnChange', async () => {
    const onChange = vi.fn()
    render(<RadioCardGroup legend="Elegí" options={options} value={null} onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: /Lunes 10:00/ }))

    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('RNF21_anUnavailableOptionShowsItsReasonAndCannotBeChosen', async () => {
    const onChange = vi.fn()
    render(<RadioCardGroup legend="Elegí" options={options} value={null} onChange={onChange} />)

    const unavailable = screen.getByRole('radio', { name: /Martes 18:00/ })
    expect(unavailable).toHaveAttribute('aria-disabled', 'true')
    expect(unavailable).toHaveAccessibleDescription('Es su turno actual.')
    await userEvent.click(unavailable)

    expect(onChange).not.toHaveBeenCalled()
    expect(unavailable).not.toBeChecked()
  })

  it('RF09_aSubtitleIsAlwaysShownUnderTheLabelAndTheReasonStaysTheDescription', () => {
    const withSubtitle = [{ value: 'a', label: 'Jue 26 de nov', subtitle: '18:00 a 20:00', unavailableReason: 'Completa' }]
    render(<RadioCardGroup legend="Elegí" options={withSubtitle} value={null} onChange={() => {}} />)

    const radio = screen.getByRole('radio', { name: /18:00 a 20:00/ })
    expect(radio.closest('label')).toHaveTextContent('Jue 26 de nov18:00 a 20:00Completa')
    expect(radio).toHaveAccessibleDescription('Completa')
  })

  it('RNF21_showsTheErrorOfTheGroupLinkedToTheFieldset', () => {
    render(
      <RadioCardGroup legend="Modalidad" options={options} value="a" onChange={() => {}} error="Elegí la modalidad." />,
    )

    expect(screen.getByRole('group', { name: 'Modalidad' })).toHaveAccessibleDescription(
      'Error: Elegí la modalidad.',
    )
    expect(screen.getByRole('radio', { name: /Lunes 10:00/ })).toBeChecked()
  })
})
