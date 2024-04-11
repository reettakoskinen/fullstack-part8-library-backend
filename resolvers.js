const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')
const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()

const Book = require('./models/book')
const Author = require('./models/author')

const resolvers = {
	Query: {
		bookCount: async () => {
			try {
				const count = await Book.countDocuments()
				return count
			} catch (error) {
				throw new GraphQLError(`Error counting books: ${error.message}`)
			}
		},
		authorCount: async () => {
			try {
				const count = await Author.countDocuments()
				return count
			} catch (error) {
				throw new GraphQLError(`Error counting authors: ${error.message}`)
			}
		},
		allBooks: async (root, args) => {
			const filter = {}
			if (args.author) {
				filter.author = args.author
			}
			if (args.genre) {
				filter.genres = args.genre
			}

			try {
				const books = await Book.find(filter)
				return books
			} catch (error) {
				throw new GraphQLError(`Error fetching books: ${error.message}`)
			}
		},
		allAuthors: async (root, args) => {
			const filter = {}
			if (args.author) {
				filter.author = args.author
			}

			try {
				const authors = await Author.find(filter)
				return authors
			} catch (error) {
				throw new GraphQLError(`Error fetching authors: ${error.message}`)
			}
		},
		me: (root, args, context) => {
			return context.currentUser
		},
	},
	Book: {
		author: async (root) => {
			try {
				const author = await Author.findById(root.author)
				if (author) {
					return {
						name: author.name,
					}
				} else {
					throw new Error(`Author not found: ${error.message}`)
				}
			} catch (error) {
				throw new GraphQLError(`Error fetching author: ${error.message}`)
			}
		},
		title: (root) => root.title,
		published: (root) => root.published,
		id: (root) => root.id,
		genres: (root) => root.genres,
	},
	Author: {
		name: (root) => root.name,
		id: (root) => root.id,
		born: (root) => root.born,
		bookCount: async (root) => {
			try {
				const count = await Book.countDocuments({ author: root.id })
				return count
			} catch (error) {
				throw new GraphQLError(
					`Error counting books for author: ${error.message}`
				)
			}
		},
	},
	User: {
		username: (root) => root.username,
		favoriteGenre: (root) => root.favoriteGenre,
	},
	Mutation: {
		addBook: async (root, args, context) => {
			let author = await Author.findOne({ name: args.author })
			const currentUser = context.currentUser

			if (!currentUser) {
				throw new GraphQLError('not authenticated')
			}

			if (!author) {
				author = new Author({ name: args.author })
				try {
					await author.save()
				} catch (error) {
					throw new GraphQLError(`Saving author failed: ${error.message}`)
				}
			}
			const book = new Book({ ...args, author: author._id })

			try {
				await book.save()
			} catch (error) {
				throw new GraphQLError(`Saving book failed: ${error.message}`)
			}

			pubsub.publish('BOOK_ADDED', { bookAdded: book })

			return book
		},
		addAuthor: async (root, args) => {
			const author = new Author({ ...args })

			try {
				await author.save()
			} catch (error) {
				throw new GraphQLError(`Saving author failed: ${error.message}`)
			}

			return author
		},
		editAuthor: async (root, args, context) => {
			const author = await Author.findOne({ name: args.name })
			author.born = args.setBornTo
			const currentUser = context.currentUser

			if (!currentUser) {
				throw new GraphQLError('not authenticated')
			}

			try {
				await author.save()
			} catch (error) {
				throw new GraphQLError(`Saving year of birth failed: ${error.message}`)
			}

			return author
		},
		createUser: async (root, args) => {
			const user = new User({
				username: args.username,
				favoriteGenre: args.favoriteGenre,
			})
			return user.save().catch((error) => {
				throw new GraphQLError(`Creating the user failed: ${error.message}`)
			})
		},
		login: async (root, args) => {
			const user = await User.findOne({ username: args.username })

			if (!user || args.password !== 'secret') {
				throw new GraphQLError('wrong credentials')
			}

			const userForToken = {
				username: user.username,
				id: user._id,
			}

			return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
		},
	},
	Subscription: {
		bookAdded: {
			subscribe: () => pubsub.asyncIterator('BOOK_ADDED'),
		},
	},
}

module.exports = resolvers
