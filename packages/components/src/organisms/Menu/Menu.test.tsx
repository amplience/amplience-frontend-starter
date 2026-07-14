// @vitest-environment jsdom
//
// Tests for the Menu organism — in particular the partition of children into
// MenuItem list items (rendered in the <ul>) and IconButtons (grouped into a
// trailing .iconGroup div). CSS module classes are empty strings in the test
// environment and are not asserted; structure is asserted via DOM shape.

import { cleanup, render } from '@testing-library/react'
import { Fragment } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { IconButton } from '../../molecules/IconButton/IconButton'
import { MenuItem } from '../../molecules/MenuItem/MenuItem'
import { Menu } from './Menu'

afterEach(cleanup)

describe('Menu', () => {
  it('renders MenuItem children in the <ul> and no icon group when there are none', () => {
    const { container } = render(
      <Menu>
        <MenuItem label="Home" link="/" />
        <MenuItem label="Shop" link="/shop" />
      </Menu>,
    )
    const ul = container.querySelector('ul')
    expect(ul?.querySelectorAll(':scope > li')).toHaveLength(2)
    // No trailing icon-group div is emitted.
    expect(container.querySelector('nav > div')).toBeNull()
  })

  it('groups IconButton children into a div after the list, not in the <ul>', () => {
    const { container } = render(
      <Menu>
        <MenuItem label="Home" link="/" />
        <IconButton icon="cart" label="Cart" link="/cart" />
      </Menu>,
    )
    const ul = container.querySelector('ul')
    expect(ul).not.toBeNull()
    // Menu item link stays in the list; the icon button does not.
    expect(ul?.querySelector('a[href="/"]')).not.toBeNull()
    expect(ul?.querySelector('a[href="/cart"]')).toBeNull()

    const group = ul?.nextElementSibling as HTMLElement | null
    expect(group?.tagName).toBe('DIV')
    expect(group?.querySelector('a[href="/cart"]')).not.toBeNull()
  })

  it('unwraps the dispatcher’s Fragment wrapper when classifying children', () => {
    const { container } = render(
      <Menu>
        <Fragment>
          <IconButton icon="user" label="Account" link="/account" />
        </Fragment>
      </Menu>,
    )
    const group = container.querySelector('ul')?.nextElementSibling as HTMLElement | null
    expect(group?.tagName).toBe('DIV')
    expect(group?.querySelector('a[href="/account"]')).not.toBeNull()
  })
})
