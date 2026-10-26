import type { Lesson } from './types';

/**
 * Authored lesson pages, keyed by topic id.
 *
 * Every page is written for a player who just munched a wrong tile, so the copy
 * names the rule, the worked example and the usual trap for that topic. All
 * text is ASCII and fits the limits enforced in lessons-data.test.ts.
 */
export const GENERATED_LESSONS: Record<string, Lesson> = {
  // -------------------------------------------------------------------------
  // Number sense
  // -------------------------------------------------------------------------
  primes: {
    summary:
      'A prime is a whole number greater than 1 with exactly two factors: 1 and itself. The primes start 2, 3, 5, 7, 11, 13 and keep going.',
    steps: [
      'Test divisors from 2 up to the square root of the number.',
      'If any of them divides evenly, the number is composite.',
      'Remember that 1 has only one factor, so it is neither prime nor composite.',
    ],
    example: {
      prompt: 'Munch every prime number.',
      answer: '7',
      why: '7 divides evenly only by 1 and 7, so it has exactly two factors and is prime.',
    },
    tip: '1 is not prime, and 9 = 3 x 3 tricks many players. 2 is the only even prime.',
  },
  factors: {
    summary:
      'A factor divides a number with no remainder, packing it into equal groups. 1 and the number itself always count.',
    steps: [
      'Test small numbers first: does the target divide evenly?',
      'Remember 1 and the target are always factors.',
      'Stop checking once the factor pairs start repeating.',
    ],
    example: {
      prompt: 'Munch every factor of 36.',
      answer: '9',
      why: '36 / 9 = 4 with no remainder, so 9 is a factor of 36.',
    },
    tip: 'Factors come in pairs: 4 x 9 = 36, so both 4 and 9 belong. 6 pairs with itself.',
  },
  multiples: {
    summary:
      'Multiples of a number are the answers to its times table: skip-count by that number. Every multiple divides by the base with no remainder.',
    steps: [
      'Start at the base and keep adding it: 6, 12, 18, 24 and so on.',
      'Check a candidate by dividing it by the base.',
      'Zero is a multiple of every number, but the board may not show it.',
    ],
    example: {
      prompt: 'Munch every multiple of 6.',
      answer: '42',
      why: '6 x 7 = 42, so 42 is on the skip-count list and 42 / 6 = 7 exactly.',
    },
    tip: 'Factors divide the target; multiples are what you get by multiplying the base. Do not mix the two.',
  },
  'even-odd': {
    summary:
      'Even numbers split into pairs with nothing left over; odd numbers always leave 1. Only the last digit matters.',
    steps: [
      'Look at the final digit: 0, 2, 4, 6 and 8 are even.',
      'A final digit of 1, 3, 5, 7 or 9 means odd.',
      'For big numbers, ignore every digit except the last one.',
    ],
    example: {
      prompt: 'Munch every even number.',
      answer: '48',
      why: '48 ends in 8, so it splits into 24 pairs with no remainder and is even.',
    },
    tip: '0 is even. A number ending in 5 is odd, no matter how large it looks.',
  },
  'perfect-squares': {
    summary:
      'A perfect square is what you get when a whole number is multiplied by itself. The list starts 1, 4, 9, 16, 25, 36, 49 and 64.',
    steps: [
      'Try the square root: if sqrt(n) is a whole number, n is a perfect square.',
      'Near misses sit just above or below a square, like 48 and 50 around 49.',
      'Perfect squares never end in 2, 3, 7 or 8.',
    ],
    example: {
      prompt: 'Munch every perfect square.',
      answer: '49',
      why: '7 x 7 = 49, so 49 is a perfect square and its square root is 7.',
    },
    tip: 'Do not confuse doubling with squaring: 7 x 2 = 14, but 7 x 7 = 49.',
  },
  divisibility: {
    summary:
      'Divisibility rules let you test a factor without long division. Each small number has its own quick check.',
    steps: [
      'For 3 or 9, add the digits and test that sum.',
      'For 4, check only the last two digits.',
      'For 6, the number must pass both the 2 rule and the 3 rule.',
    ],
    example: {
      prompt: 'Munch every number divisible by 3.',
      answer: '51',
      why: '5 + 1 = 6, and 6 is a multiple of 3, so 51 is divisible by 3.',
    },
    tip: 'For 11, add and subtract alternating digits. A final digit of 0 or 5 only proves divisibility by 5.',
  },

  // -------------------------------------------------------------------------
  // Arithmetic
  // -------------------------------------------------------------------------
  equality: {
    summary:
      'An expression equals the target when both sides have the same value after all operations. Different-looking tiles can be equal.',
    steps: [
      'Work out each tile completely before you decide.',
      'Follow the order of operations inside the expression.',
      'Compare the result with the target, not the shape of the expression.',
    ],
    example: {
      prompt: 'Munch every expression that equals 20.',
      answer: '13+7',
      why: '13 + 7 = 20, so this expression lands exactly on the target.',
    },
    tip: 'Different shapes can share a value: 13+7 and 4x5 both equal 20. Compute, do not pattern-match.',
  },
  inequality: {
    summary:
      'An inequality names a boundary and a direction. Strict signs < and > exclude the boundary; <= and >= include it.',
    steps: [
      'Find the boundary number first.',
      'Decide whether the boundary itself belongs.',
      'Test a sample value on each side of the boundary.',
    ],
    example: {
      prompt: 'Munch every value < 40.',
      answer: '37',
      why: '37 is less than 40, so it satisfies the strict inequality < 40.',
    },
    tip: 'The boundary is the usual trap: 40 does not satisfy x < 40, but it does satisfy x <= 40.',
  },
  'place-value': {
    summary:
      'Each digit is worth its face value times its place: ones, tens, hundreds and so on. Moving one place left multiplies the value by 10.',
    steps: [
      'Find the named digit and count its position from the right.',
      'Multiply the digit by 1, 10, 100 or 1000 for that place.',
      'Match the total worth, not just the digit.',
    ],
    example: {
      prompt: 'Munch every number where the 4 is worth 400.',
      answer: '472',
      why: 'In 472 the 4 sits in the hundreds place, so it is worth 4 x 100 = 400.',
    },
    tip: 'A digit can appear twice with different values. Check the place, not just the presence of the digit.',
  },
  rounding: {
    summary:
      'Rounding swaps a number for the nearest friendly multiple of 10, 100 or 1000. The digit just to the right decides whether to round up.',
    steps: [
      'Find the two multiples the number sits between.',
      'Look at the next digit: 5 or more rounds up, 4 or less rounds down.',
      'Keep the target place and replace the digits to its right with zeros.',
    ],
    example: {
      prompt: 'Munch every number that rounds to 300 at the nearest 100.',
      answer: '287',
      why: '287 sits between 200 and 300; it is 13 above 200 and 87 below 300, so 300 is nearer.',
    },
    tip: 'Round once, not twice. 249 rounds to 200, but rounding to 10 first gives 250 and then 300.',
  },
  fractions: {
    summary:
      'Equivalent fractions are different fraction tiles for the same amount. Multiplying or dividing top and bottom by the same number keeps the value.',
    steps: [
      'Cross-multiply: compare the top of one with the bottom of the other.',
      'Or scale both parts by the same factor.',
      'Simplify both fractions to check that they match.',
    ],
    example: {
      prompt: 'Munch every fraction equal to 3/4.',
      answer: '9/12',
      why: '3 x 12 = 4 x 9 = 36, so the cross products match and 9/12 = 3/4.',
    },
    tip: 'Adding the same number to top and bottom changes the value. Only multiplying or dividing keeps it equal.',
  },
  decimals: {
    summary:
      'Fractions, decimals and percents are three costumes for the same number. Convert everything to one form before comparing.',
    steps: [
      'Divide the top by the bottom to turn a fraction into a decimal.',
      'Percent means per 100: 75% is 75/100 = 0.75.',
      'Line up the decimal places when comparing two decimals.',
    ],
    example: {
      prompt: 'Munch every tile equal to 0.75.',
      answer: '75%',
      why: '75% means 75 per 100, and 75/100 = 0.75, so the tile matches.',
    },
    tip: '0.7 and 0.70 are equal, but 0.07 is much smaller. Count the places after the decimal point.',
  },
  percents: {
    summary:
      'A percent is a fraction with denominator 100. To compare percents with fractions and decimals, convert them all to the same form.',
    steps: [
      'Write the percent over 100: 40% = 40/100.',
      'Reduce the fraction: 40/100 = 2/5.',
      'Or divide by 100 for the decimal: 0.4.',
    ],
    example: {
      prompt: 'Munch every expression equal to 40%.',
      answer: '2/5',
      why: '2/5 = 0.4, and 40% also equals 0.4, so the values match.',
    },
    tip: 'Percent means per 100, not per 10. 40% is 0.4, while 4% is only 0.04.',
  },
  integers: {
    summary:
      'Integers include positive numbers, negative numbers and zero. The sign in front of a number is part of its value.',
    steps: [
      'Treat subtraction as adding the opposite: 5-8 = 5+(-8).',
      'Two negatives multiplied or divided make a positive.',
      'Keep the sign when you rewrite an expression.',
    ],
    example: {
      prompt: 'Munch every expression equal to -12.',
      answer: '-5-7',
      why: '-5 - 7 = -5 + (-7) = -12, so the expression equals the target.',
    },
    tip: 'Subtracting a negative adds: 8-(-3) = 11. Do not drop a minus sign when you rearrange.',
  },
  'order-of-operations': {
    summary:
      'Order of operations is the agreed sequence for evaluating an expression. It keeps everyone from getting different answers to the same tile.',
    steps: [
      'Do brackets and powers first.',
      'Then multiply and divide from left to right.',
      'Finally add and subtract from left to right.',
    ],
    example: {
      prompt: 'Munch every expression that equals 14.',
      answer: '2+3x4',
      why: 'Multiply first: 3 x 4 = 12, then add 2 to get 14.',
    },
    tip: 'Working left to right is wrong when x or / sits beside + or -. Do multiplication first.',
  },
  exponents: {
    summary:
      'A power tells you how many copies of the base to multiply. A root asks which number was multiplied by itself.',
    steps: [
      'Expand small powers: 2^5 = 2 x 2 x 2 x 2 x 2.',
      'Use roots backwards: sqrt(64) = 8 because 8^2 = 64.',
      'Check the whole expression, not just its base.',
    ],
    example: {
      prompt: 'Munch every expression that equals 64.',
      answer: '8^2',
      why: '8^2 means 8 x 8, which is 64, so this tile hits the target.',
    },
    tip: 'sqrt(64) is 8, not 32. A root undoes a power; it does not halve the number.',
  },

  // -------------------------------------------------------------------------
  // Algebra
  // -------------------------------------------------------------------------
  'evaluate-expressions': {
    summary:
      'Evaluating means replacing the variable with a number and doing the arithmetic. The same expression can have different values for different x.',
    steps: [
      'Put brackets around the substituted value.',
      'Multiply before adding or subtracting.',
      'Check the sign when x is negative.',
    ],
    example: {
      prompt: 'When x = 4, munch every tile equal to 14.',
      answer: '3x+2',
      why: '3(4) + 2 = 12 + 2 = 14, so the expression equals the target when x = 4.',
    },
    tip: '3x means 3 times x, not 3 plus x. Substitute first, then multiply.',
  },
  'solve-linear': {
    summary:
      'Solving a linear equation means finding the x that makes both sides equal. Undo the operations in reverse order.',
    steps: [
      'Add or subtract to remove the constant from the x side.',
      'Divide by the coefficient of x.',
      'Substitute your answer back to check.',
    ],
    example: {
      prompt: 'Munch every solution of 2x+3=11.',
      answer: '4',
      why: '2(4) + 3 = 8 + 3 = 11, so x = 4 makes the equation true.',
    },
    tip: 'Do the same thing to both sides. If you divide by a negative, keep the sign with the answer.',
  },
  'linear-inequalities': {
    summary:
      'A linear inequality has a range of solutions, not one value. Solve it like an equation, then handle the boundary carefully.',
    steps: [
      'Isolate x the same way you would in an equation.',
      'Flip the sign when you multiply or divide by a negative.',
      'Include the boundary only for <= or >=.',
    ],
    example: {
      prompt: 'Munch every x with 2x+3>=11.',
      answer: '5',
      why: '2(5) + 3 = 13, and 13 >= 11 is true, so x = 5 is a solution.',
    },
    tip: 'The classic trap is forgetting to flip >= to <= when you divide by a negative number.',
  },
  slope: {
    summary:
      'Slope measures steepness: rise over run between two points, or the x coefficient in y=mx+b. It can be positive, negative, zero or undefined.',
    steps: [
      'Subtract the y-values for the rise.',
      'Subtract the x-values in the same order for the run.',
      'Divide rise by run and simplify.',
    ],
    example: {
      prompt: 'Munch every tile equal to the slope of (1,2) to (3,6).',
      answer: '2',
      why: 'Rise = 6 - 2 = 4 and run = 3 - 1 = 2, so slope = 4/2 = 2.',
    },
    tip: 'A vertical line has run 0, so its slope is undefined, not 0. A horizontal line has slope 0.',
  },
  systems: {
    summary:
      'A system of equations asks for values that satisfy every equation at once. The solution is usually an ordered pair (x,y).',
    steps: [
      'Substitute the pair into the first equation.',
      'Substitute the same pair into the second equation.',
      'Both equations must be true; one is not enough.',
    ],
    example: {
      prompt: 'Munch every pair that solves y=x+1 and 2y=2x+2.',
      answer: '(1,2)',
      why: '1 + 1 = 2 and 2 x 2 = 2 x 1 + 2 = 4, so (1,2) makes both equations true at once.',
    },
    tip: 'A pair that solves only one equation is a decoy. Dependent systems share infinitely many pairs.',
  },
  polynomials: {
    summary:
      'Polynomial operations rewrite an expression without changing its value. Expanding, factoring and collecting like terms are all fair moves.',
    steps: [
      'Multiply every term in one bracket by every term in the other.',
      'Combine like terms by adding their coefficients.',
      'Check by substituting a value for x.',
    ],
    example: {
      prompt: 'Munch every expression equal to x^2-9.',
      answer: '(x-3)(x+3)',
      why: 'Expanding (x-3)(x+3) gives x^2 - 3x + 3x - 9 = x^2 - 9.',
    },
    tip: 'x^2-9 is a difference of squares, not (x-3)^2. Squaring a binomial leaves a middle term.',
  },
  factoring: {
    summary:
      'Factoring reverses expansion and reveals the roots of a quadratic. A binomial x-r is a factor exactly when x=r makes the quadratic zero.',
    steps: [
      'Find two numbers that multiply to the constant term.',
      'Check that the same two numbers add to the x coefficient.',
      'Write the factors as (x-r1)(x-r2), flipping the signs.',
    ],
    example: {
      prompt: 'Munch every binomial with a root of x^2-7x+12.',
      answer: 'x-3',
      why: 'Substituting x = 3 gives 9 - 21 + 12 = 0, so x-3 is a factor.',
    },
    tip: 'Roots 3 and 4 give factors x-3 and x-4. The signs flip between root and factor.',
  },
  quadratics: {
    summary:
      'Quadratic roots are the x-values where the parabola crosses the x-axis. The discriminant b^2-4ac tells you how many real roots exist.',
    steps: [
      'Compute b^2 - 4ac before trying to factor.',
      'D > 0 gives two real roots and D = 0 gives one repeated root.',
      'D < 0 means no real roots.',
    ],
    example: {
      prompt: 'No real roots. Munch every tile showing a negative discriminant.',
      answer: 'D<0',
      why: 'For x^2+x+1, b^2-4ac = 1-4 = -3, which is negative, so there are no real roots.',
    },
    tip: 'Do not read D<0 as two roots. It means the parabola never touches the x-axis.',
  },
  'exponent-rules': {
    summary:
      'Exponent rules turn products, quotients and powers of powers into a single power. Add exponents when multiplying and subtract when dividing.',
    steps: [
      'x^a*x^b = x^(a+b): add exponents for a product.',
      'x^a/x^b = x^(a-b): subtract for a quotient.',
      '(x^a)^b = x^(a*b): multiply for a power of a power.',
    ],
    example: {
      prompt: 'Munch every expression equal to x^5.',
      answer: 'x^2*x^3',
      why: 'Multiplying powers with the same base adds exponents: 2 + 3 = 5, so the result is x^5.',
    },
    tip: 'Add exponents for products and multiply them for a power of a power. Mixing those up is the usual mistake.',
  },
  functions: {
    summary:
      'A function assigns exactly one output to each input. f(4) means the output when x is 4, not f times 4.',
    steps: [
      'Replace every x in the formula with the input value.',
      'Use brackets around negative inputs.',
      'Simplify using the order of operations.',
    ],
    example: {
      prompt: 'Munch every tile equal to f(4) when f(x)=3x+2.',
      answer: '14',
      why: 'f(4) = 3(4) + 2 = 12 + 2 = 14, so the output is 14.',
    },
    tip: 'f(4) is not f times 4. The brackets mean substitute 4 for the input.',
  },
  sequences: {
    summary:
      'A sequence is an ordered list built by a rule. Arithmetic sequences add a constant; geometric sequences multiply by a constant.',
    steps: [
      'Find the gap between consecutive terms.',
      'If the gaps are equal, add that gap to continue.',
      'If each term is a constant multiple, multiply instead.',
    ],
    example: {
      prompt: 'Munch every number that belongs to the sequence.',
      answer: '19',
      why: 'The sequence 3, 7, 11, 15 adds 4 each time, and 19 = 3 + 4 x 4, so 19 is a term.',
    },
    tip: 'Check the rule before munching. A number close to a term is not a term unless it fits the pattern exactly.',
  },
  logs: {
    summary:
      'A logarithm asks what exponent you need. log2(32) = 5 because 2^5 = 32.',
    steps: [
      'Rewrite log_b(x)=y as b^y=x.',
      'For log with no base, assume base 10; ln uses base e.',
      'A negative log means the answer is a fraction below 1.',
    ],
    example: {
      prompt: 'Munch every expression equal to 5.',
      answer: 'log2(32)',
      why: '2^5 = 32, so log base 2 of 32 is 5.',
    },
    tip: 'log2(1) = 0 because any nonzero base to the power 0 is 1. log(0) is undefined, not negative.',
  },

  // -------------------------------------------------------------------------
  // Geometry
  // -------------------------------------------------------------------------
  angles: {
    summary:
      'Complementary angles add to 90 degrees; supplementary angles add to 180. Vertical angles are equal.',
    steps: [
      'Read which relationship the prompt names.',
      'Subtract the given angle from 90 or 180.',
      'For vertical angles, copy the given measure.',
    ],
    example: {
      prompt: 'Munch every measure complementary to 35 deg.',
      answer: '55',
      why: 'Complementary angles add to 90, and 90 - 35 = 55, so 55 deg is the complement.',
    },
    tip: 'Complement goes with 90 and supplement with 180. Mixing those two is the most common slip.',
  },
  'triangle-types': {
    summary:
      'Triangles can be classified by angles (acute, right, obtuse) or by sides (equilateral, isosceles, scalene). Angle sums and side lengths decide.',
    steps: [
      'Check that angles add to 180 or sides satisfy a+b>c.',
      'By angles: all below 90 is acute, one 90 is right, one above 90 is obtuse.',
      'By sides: all equal, two equal, or all different.',
    ],
    example: {
      prompt: 'Munch every angle set (in deg) that forms an acute triangle.',
      answer: '60,60,60',
      why: '60 + 60 + 60 = 180 and every angle is below 90, so the triangle is acute.',
    },
    tip: 'A side set with a+b<=c cannot form a triangle at all, no matter how it is classified.',
  },
  pythagorean: {
    summary:
      'In a right triangle, a^2+b^2=c^2, where c is the hypotenuse. Use it to find a missing side.',
    steps: [
      'Identify the hypotenuse: the side across from the right angle.',
      'For the hypotenuse, add the squares and take the square root.',
      'For a leg, subtract the known square before taking the root.',
    ],
    example: {
      prompt: 'Legs 3 and 4: munch the missing hypotenuse.',
      answer: '5',
      why: '3^2 + 4^2 = 9 + 16 = 25, and sqrt(25) = 5, so the hypotenuse is 5.',
    },
    tip: 'The hypotenuse is the longest side. Do not add the squares when you are missing a leg; subtract.',
  },
  'area-perimeter': {
    summary:
      'Area measures the space inside a shape; perimeter measures the distance around it. Rectangle area is length times width.',
    steps: [
      'For a rectangle, area = length x width and perimeter = 2(length + width).',
      'For a triangle, area = base x height / 2.',
      'Use square units for area and plain units for perimeter.',
    ],
    example: {
      prompt: 'Rectangle 6x4: munch every tile equal to the area.',
      answer: '24',
      why: 'Area of a rectangle is length x width, and 6 x 4 = 24.',
    },
    tip: 'A triangle is half of a rectangle with the same base and height, so divide by 2.',
  },
  circles: {
    summary:
      'Circle formulas use the radius r. Circumference is 2*pi*r and area is pi*r^2.',
    steps: [
      'Check whether the prompt gives radius or diameter.',
      'If it gives diameter, halve it before using r.',
      'Keep the answer in terms of pi or use pi = 3.14 as the prompt says.',
    ],
    example: {
      prompt: 'Circle r=5: munch every tile equal to the circumference.',
      answer: '10pi',
      why: 'C = 2*pi*r = 2*pi*5 = 10pi, so 10pi is the circumference.',
    },
    tip: 'Diameter is twice the radius, not the radius. Area uses r^2, so a circle with r=5 has area 25pi.',
  },
  volume: {
    summary:
      'Volume measures the space inside a 3D solid; surface area measures its outside. Prisms use area of base times height.',
    steps: [
      'Find the base area before multiplying by height.',
      'A cone is one third of the cylinder with the same base and height.',
      'Surface area adds every face, so do not use a volume formula.',
    ],
    example: {
      prompt: 'Cylinder r=3,h=4: munch every tile equal to the volume.',
      answer: '36pi',
      why: 'V = pi*r^2*h = pi*3^2*4 = 36pi.',
    },
    tip: 'Cone volume is pi*r^2*h/3. Sphere volume is 4/3*pi*r^3, not 4*pi*r^2.',
  },
  'coordinate-geometry': {
    summary:
      'The coordinate plane is split into four quadrants by the axes. A point is written (x,y) with x first.',
    steps: [
      'Read x first, then y.',
      'Quadrant I is (+,+), II is (-,+), III is (-,-), IV is (+,-).',
      'A zero coordinate puts the point on an axis, not in a quadrant.',
    ],
    example: {
      prompt: 'Munch every point in quadrant II.',
      answer: '(-3,2)',
      why: 'x = -3 is negative and y = 2 is positive, which places the point in quadrant II.',
    },
    tip: 'The axes themselves belong to no quadrant. Order matters: (2,-3) is quadrant IV, not II.',
  },
  polygons: {
    summary:
      'Polygons are named by their number of sides. Interior angles and diagonals follow formulas based on n.',
    steps: [
      'Count the sides to name the polygon.',
      'Interior angle sum = (n-2) x 180 degrees.',
      'Diagonals = n(n-3)/2.',
    ],
    example: {
      prompt: 'Hexagon: munch every tile equal to the interior angle sum.',
      answer: '720',
      why: 'A hexagon has 6 sides, so (6-2) x 180 = 4 x 180 = 720 degrees.',
    },
    tip: 'The exterior angles of any convex polygon add to 360, but the interior sum grows with n.',
  },
  similarity: {
    summary:
      'Similar figures have the same shape and equal angles; their sides are multiplied by one scale factor.',
    steps: [
      'Match corresponding sides, not just any two sides.',
      'Divide a side in the image by its matching side in the original.',
      'Use the scale factor to find every missing length.',
    ],
    example: {
      prompt: 'Munch every side pair with scale factor 3.',
      answer: '4:12',
      why: '12 / 4 = 3, so the second side is three times the first.',
    },
    tip: 'Similar triangles are not necessarily congruent. Equal angles alone do not mean equal side lengths.',
  },
  'circle-theorems': {
    summary:
      'Circle theorems link angles at the centre, on the circumference, and in cyclic quadrilaterals.',
    steps: [
      'A central angle is twice an inscribed angle on the same arc.',
      'Opposite angles of a cyclic quadrilateral add to 180.',
      'A tangent meets a radius at exactly 90 degrees.',
    ],
    example: {
      prompt: 'Munch every pair (inscribed, central) where central = 2 x inscribed.',
      answer: '40,80',
      why: '2 x 40 = 80, so the central angle is twice the inscribed angle.',
    },
    tip: 'The tangent-radius angle is always 90 degrees. Do not use 180 here; that is a straight line.',
  },

  // -------------------------------------------------------------------------
  // Triangle pictures and visual geometry
  // -------------------------------------------------------------------------
  'triangle-pictures': {
    summary:
      'Triangle pictures show angles and tick marks. Tick marks mean equal sides, and a small square means a right angle.',
    steps: [
      'For angle questions, find any angle of 90 or above.',
      'For side questions, count equal tick marks.',
      'All angles below 90 means acute; all sides equal means equilateral.',
    ],
    example: {
      prompt: 'Munch every acute triangle.',
      answer: 'an equilateral triangle',
      why: 'All three angles are 60 degrees, which is below 90, so the triangle is acute.',
    },
    tip: 'An equilateral triangle is also acute. Equal sides do not make it right unless an angle is 90.',
  },
  'solid-or-flat': {
    summary:
      'Flat shapes have two dimensions; solids have three. A drawing of a solid shows depth, while a flat shape does not.',
    steps: [
      'Look for depth, edges going back, or a visible top and side.',
      'A square, circle or triangle drawn flat is 2D.',
      'A cube, prism, cylinder or sphere is 3D.',
    ],
    example: {
      prompt: 'Munch every 3D solid.',
      answer: 'cube',
      why: 'A cube has length, width and depth, so it is a solid; a square is only flat.',
    },
    tip: 'A circle is flat, but a sphere is solid. A rectangle is flat, but a rectangular prism is solid.',
  },
  'solid-attributes': {
    summary:
      'Solids can be sorted by their surfaces and bases. Curved surfaces, flat faces, parallel bases and points are the key clues.',
    steps: [
      'Curved: cylinder, cone and sphere have at least one curved surface.',
      'Flat faces only: cube, prism and pyramid.',
      'Parallel bases: prism and cylinder; a point: cone and pyramid.',
    ],
    example: {
      prompt: 'Munch every solid with a curved surface.',
      answer: 'cylinder',
      why: 'A cylinder has a smooth curved side, while a cube has only flat square faces.',
    },
    tip: 'A cone is curved and pointy; a pyramid is pointy but has flat faces. Check both properties.',
  },

  // -------------------------------------------------------------------------
  // Graphs
  // -------------------------------------------------------------------------
  'function-families': {
    summary:
      'Function families have signature shapes: lines, parabolas, exponentials, logs and more. The shape identifies the family.',
    steps: [
      'A straight line is linear; a U-shape is quadratic.',
      'An exponential curve climbs faster and faster on one side.',
      'A logarithmic curve rises quickly then flattens.',
    ],
    example: {
      prompt: 'Munch every graph of a quadratic function.',
      answer: 'a U-shaped parabola',
      why: 'A quadratic graph is a symmetric U or upside-down U, while a straight line is linear.',
    },
    tip: 'A parabola can open down and still be quadratic. Family comes from the shape, not the direction.',
  },
  'graph-features': {
    summary:
      'Graph features describe behaviour: increasing, decreasing, maximum, minimum and intercepts. Read the whole curve, not one point.',
    steps: [
      'Always increasing means the graph never falls as x moves right.',
      'A minimum is the lowest turning point; a maximum is the highest.',
      'Never negative means the graph stays on or above the x-axis.',
    ],
    example: {
      prompt: 'Munch every graph that is always increasing.',
      answer: 'a straight line rising left to right',
      why: 'Its y-value grows steadily as x moves right, so it never turns back down.',
    },
    tip: 'A U-shaped parabola is not always increasing: it falls, turns, then rises. Check the whole domain.',
  },

  // -------------------------------------------------------------------------
  // Trigonometry
  // -------------------------------------------------------------------------
  'trig-ratios': {
    summary:
      'Sine, cosine and tangent compare sides of a right triangle. SOH CAH TOA keeps the ratios straight.',
    steps: [
      'Label the side opposite the angle, the adjacent side and the hypotenuse.',
      'sin = opposite/hypotenuse.',
      'cos = adjacent/hypotenuse and tan = opposite/adjacent.',
    ],
    example: {
      prompt: 'Munch every fraction equal to sin A. (opp=3, hyp=5)',
      answer: '3/5',
      why: 'sin A = opposite / hypotenuse = 3/5.',
    },
    tip: 'The hypotenuse is never the adjacent side. For tan use opposite/adjacent, not opposite/hypotenuse.',
  },
  'special-angles': {
    summary:
      'Special angles have exact trig values you can memorise. They come from the 30-60-90 and 45-45-90 triangles.',
    steps: [
      'Learn sin 30 = 1/2, cos 30 = sqrt(3)/2 and tan 30 = sqrt(3)/3.',
      'Learn sin 45 = cos 45 = sqrt(2)/2 and tan 45 = 1.',
      'Use sin 90 = 1, cos 90 = 0 and tan 90 = undefined.',
    ],
    example: {
      prompt: 'Munch every tile equal to the exact value of sin 30 deg.',
      answer: '1/2',
      why: 'In a 30-60-90 triangle the side opposite 30 is half the hypotenuse, so sin 30 = 1/2.',
    },
    tip: 'tan 90 is undefined, not infinity. The cosine in the denominator is 0.',
  },
  'trig-identities': {
    summary:
      'Trig identities are equations true for every angle. They let you swap one expression for an equivalent one.',
    steps: [
      'Start with sin^2(x)+cos^2(x)=1.',
      'Use cos(2x)=cos^2(x)-sin^2(x) and sin(2x)=2 sin(x)cos(x).',
      'Write tan(x) as sin(x)/cos(x).',
    ],
    example: {
      prompt: 'Munch every expression equal to sin^2(x)+cos^2(x).',
      answer: '1',
      why: 'The Pythagorean identity says sin^2(x)+cos^2(x)=1 for every angle x.',
    },
    tip: 'cos(2x) is cos^2-sin^2, not 2 sin cos. The double-angle sine has the 2 sin cos form.',
  },
  'radians-degrees': {
    summary:
      'Radians and degrees are two units for the same angle. A full turn is 360 degrees or 2pi radians.',
    steps: [
      'Multiply degrees by pi/180 to get radians.',
      'Multiply radians by 180/pi to get degrees.',
      'Memorise benchmarks: 180 deg = pi, 90 deg = pi/2, 60 deg = pi/3.',
    ],
    example: {
      prompt: 'Munch every tile equal to 135 deg.',
      answer: '3pi/4',
      why: '135/180 = 3/4, so 135 degrees is 3pi/4 radians.',
    },
    tip: 'Do not drop the pi. 135 deg is 3pi/4, not 3/4.',
  },

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------
  'central-tendency': {
    summary:
      'Mean, median and mode are three ways to describe the centre of data. They answer different questions.',
    steps: [
      'Mean: add all values and divide by how many there are.',
      'Median: sort the data and take the middle value.',
      'Mode: find the value that appears most often.',
    ],
    example: {
      prompt: 'Data: 2,4,4,6,9. Munch every tile equal to the mean.',
      answer: '5',
      why: 'The sum is 25 and there are 5 values, so the mean is 25/5 = 5.',
    },
    tip: 'The median needs sorted data. For an even count, average the two middle values.',
  },
  probability: {
    summary:
      'Probability is favourable outcomes divided by total equally likely outcomes. It is always between 0 and 1.',
    steps: [
      'Count the outcomes that fit the event.',
      'Count every equally likely outcome in the sample space.',
      'Divide favourable by total and simplify.',
    ],
    example: {
      prompt: 'Munch every tile equal to P(even) for one die.',
      answer: '1/2',
      why: 'A die has 3 even faces out of 6, so P(even) = 3/6 = 1/2.',
    },
    tip: 'For two dice there are 36 outcomes, not 12. Count ordered pairs when the total is 36.',
  },
  counting: {
    summary:
      'Counting shortcuts avoid listing every arrangement. Permutations count order; combinations ignore it.',
    steps: [
      'Decide whether order matters.',
      'If order matters, use nPr = n!/(n-r)!.',
      'If not, use nCr = nPr/r!.',
    ],
    example: {
      prompt: 'Munch every numeric tile equal to 5C2.',
      answer: '10',
      why: '5C2 = (5 x 4)/2 = 20/2 = 10, and choosing 2 of 5 ignores order.',
    },
    tip: 'nCr is always smaller than nPr for the same n and r. Dividing by r! removes duplicate orderings.',
  },
  'percent-change': {
    summary:
      'Percent change compares the size of a change to the original value. It is (new - old)/old x 100.',
    steps: [
      'Subtract the old value from the new value.',
      'Divide by the original old value, never the new one.',
      'Multiply by 100 and keep the sign.',
    ],
    example: {
      prompt: '50 -> 40: munch every tile equal to the percent change.',
      answer: '-20%',
      why: '(40 - 50)/50 x 100 = -10/50 x 100 = -20%, so the value dropped 20%.',
    },
    tip: 'A drop is a negative percent change. Doubling is +100%, not +200%.',
  },
  spread: {
    summary:
      'Range and interquartile range measure how spread out data is. Range uses the extremes; IQR uses the middle half.',
    steps: [
      'Range = maximum - minimum.',
      'Sort the data and find Q1 and Q3.',
      'IQR = Q3 - Q1; it ignores outliers.',
    ],
    example: {
      prompt: 'Data: 3,7,8,10,15. Munch every tile equal to the range.',
      answer: '12',
      why: 'The maximum is 15 and the minimum is 3, so the range is 15 - 3 = 12.',
    },
    tip: 'IQR is not max minus min. It is Q3 minus Q1, so outliers barely affect it.',
  },
  'unit-rates': {
    summary:
      'A unit rate rewrites a comparison so the second quantity is 1. Miles per hour and dollars per pound are unit rates.',
    steps: [
      'Write the rate as a fraction with its units in the numerator and denominator.',
      'Divide the numerator by the denominator.',
      'Keep the units: 20 miles / 4 hours = 5 miles per hour.',
    ],
    example: {
      prompt: 'Rate: 20 miles / 4 hours. Munch every tile equal to the unit rate.',
      answer: '5',
      why: '20 miles divided by 4 hours gives 5 miles per hour, so the unit rate is 5.',
    },
    tip: 'Divide by the quantity you want to become 1. Dollars per pound means dollars divided by pounds.',
  },

  // -------------------------------------------------------------------------
  // Pre-calculus
  // -------------------------------------------------------------------------
  'function-transformations': {
    summary:
      'Transformations move or stretch a parent graph. Changes outside f affect y; changes inside f affect x.',
    steps: [
      'f(x)+k shifts the graph up by k; f(x)-k shifts it down.',
      'f(x-h) shifts right by h; f(x+h) shifts left by h.',
      'a*f(x) stretches vertically; -f(x) reflects over the x-axis.',
    ],
    example: {
      prompt: 'For f(x)=x^2, munch every expression equal to g(x)=f(x)+3.',
      answer: 'x^2+3',
      why: 'Adding 3 outside the function raises every output by 3, so g(x) = x^2+3.',
    },
    tip: 'Inside changes work backwards: f(x-3) moves right, not left. Outside changes move the graph up or down.',
  },
  limits: {
    summary:
      'A limit describes the value a function approaches near a point, not necessarily the value at the point. Both sides must agree.',
    steps: [
      'Substitute the approach value first.',
      'If you get 0/0, factor or simplify before substituting again.',
      'Compare the left-hand and right-hand approaches.',
    ],
    example: {
      prompt: 'Munch every tile equal to lim x->2 (x^2-4)/(x-2).',
      answer: '4',
      why: 'Factor to (x-2)(x+2)/(x-2) = x+2, and as x approaches 2 this approaches 4.',
    },
    tip: '0/0 means more work, not that the limit is 0. If the two sides disagree, the limit is DNE.',
  },
  derivatives: {
    summary:
      'A derivative gives the instantaneous rate of change, or the slope of the tangent line. The power rule handles x^n.',
    steps: [
      'Power rule: d/dx x^n = n*x^(n-1).',
      'The derivative of a constant is 0.',
      'Differentiate sums term by term and keep coefficients.',
    ],
    example: {
      prompt: "Munch every expression equal to f'(x) for f(x)=x^3.",
      answer: '3x^2',
      why: 'Bring down the exponent 3 and reduce it by 1, so d/dx x^3 = 3x^2.',
    },
    tip: 'x^3 differentiates to 3x^2, not 3x. Subtract one from the exponent every time.',
  },
  series: {
    summary:
      'A series adds the terms of a sequence. Finite arithmetic and geometric series have closed-form sums; infinite geometric series converge only when |r|<1.',
    steps: [
      'Arithmetic sum = n(first + last)/2.',
      'Finite geometric sum = a(1-r^n)/(1-r).',
      'Infinite geometric sum = a/(1-r) only when |r|<1.',
    ],
    example: {
      prompt: 'Munch every tile equal to 2+5+8+...+29.',
      answer: '155',
      why: 'There are 10 terms with average (2+29)/2 = 15.5, so the sum is 10 x 15.5 = 155.',
    },
    tip: 'If |r|>=1 the infinite geometric series diverges and has no finite sum. Do not plug it into a/(1-r).',
  },
};
