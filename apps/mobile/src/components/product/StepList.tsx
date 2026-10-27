import { Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { makeStyles } from '../../lib/theme'
import { ProductGroup, ProductRow, ROW_SQUARE } from './ProductGroup'
import { useToneColors, type ProductTone } from './tone'

export interface ProductStep {
  key: string
  title: string
  body?: string
}

/**
 * How far a step's number grows with the reader's text size. It sits in a
 * fixed disc, as the streak ladder's figures do; the step's words beside it
 * grow in full and say the same number to a screen reader.
 */
const NUMBER_MAX_SCALE = 1.4

/**
 * How to use something, in order: Copilot's four steps, the daily pool.
 *
 * One block of rows, each led by its number on a disc in the page's colour
 * where a feature row has its square — so the words of a step and of a
 * feature start on the same line down the page. The numbers are in the
 * reader's own digits. A screen reader hears each step as one item — "Step 2
 * of 4", then its words.
 */
export function StepList({ tone, steps }: { tone: ProductTone; steps: readonly ProductStep[] }) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { ground, on } = useToneColors(tone)

  return (
    <ProductGroup>
      {steps.map((step, index) => (
        <ProductRow
          key={step.key}
          leading={
            <View style={styles.slot}>
              <View style={[styles.disc, { backgroundColor: ground }]}>
                <Text
                  style={[styles.number, { color: on }]}
                  maxFontSizeMultiplier={NUMBER_MAX_SCALE}
                >
                  {(index + 1).toLocaleString(locale)}
                </Text>
              </View>
            </View>
          }
          title={step.title}
          body={step.body}
          accessibilityLabel={[
            t('productPage.step', { step: index + 1, total: steps.length }),
            step.title,
            step.body,
          ]
            .filter(Boolean)
            .join('. ')}
        />
      ))}
    </ProductGroup>
  )
}

const DISC = 32

const useStyles = makeStyles(({ v3 }) => ({
  // The width of a feature row's square, so the words line up with theirs.
  slot: { alignItems: 'center', width: ROW_SQUARE },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: DISC,
    justifyContent: 'center',
    width: DISC,
  },
  number: v3.type.label,
}))
